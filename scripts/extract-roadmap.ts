/**
 * Roadmap extraction — canonical HTML → normalized application data.
 *
 *   source/Master-Roadmap-AI-Cloud-v2.html
 *        ↓  parse <script>: DATA (JSON), PROMPTS/TYPE/PRI (JS literals), view copy (HTML-in-JS)
 *        ↓  normalize (stable IDs, derived indexes, DSA ↔ schedule links)
 *        ↓  exclude the VLSI block (counted for the migration audit, never emitted)
 *   src/data/generated/*.json
 *
 * Deterministic: same input → byte-identical output (no timestamps, sorted keys where relevant).
 * Fails loudly on anything unexpected; run `npm run validate-roadmap` afterwards.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "source", "Master-Roadmap-AI-Cloud-v2.html");
const OUT = path.join(ROOT, "src", "data", "generated");
export const ROADMAP_VERSION = "AI-CLOUD-ROADMAP-V2";

function fail(msg: string): never {
  console.error(`✖ extract-roadmap: ${msg}`);
  process.exit(1);
}

const html = readFileSync(SOURCE, "utf8");
const sourceSha256 = createHash("sha256").update(html).digest("hex");
const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
if (!scriptMatch) fail("no <script> block found in source HTML");
const script = scriptMatch[1];

/** Return the balanced literal ({…} or […]) that starts at `start`. String/template aware. */
function balancedLiteral(src: string, start: number): string {
  const open = src[start];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  if (!close) fail(`balancedLiteral: expected { or [ at ${start}, got ${open}`);
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  fail("unbalanced literal");
}

function literalAfter(marker: string): string {
  const at = script.indexOf(marker);
  if (at < 0) fail(`marker not found: ${marker}`);
  let i = at + marker.length;
  while (/\s/.test(script[i])) i++;
  return balancedLiteral(script, i);
}

function evalLiteral<T>(lit: string): T {
  return vm.runInNewContext(`(${lit})`, Object.create(null), { timeout: 2000 }) as T;
}

// ───────────────────────────────────────────── 1. DATA (JSON)
type SrcTask = { t: string; min: number; p: "M" | "S" | "N"; type: string; res?: string; id: string; auto?: boolean; proj?: string; added?: boolean };
type SrcDay = { d: number; title: string; tasks: SrcTask[]; min: number };
type SrcWeek = {
  n: number; phase: string; title: string; objective: string; hours: number; topics: string[]; theory: string; practice: string;
  deliverables: string[]; checkpoint: string[]; res: string[]; days: SrcDay[]; review: { knowledge: string[]; practical: string[] };
};
type SrcData = {
  phases: { id: string; name: string; short: string; weeks: number[]; goal: string }[];
  weeks: SrcWeek[];
  resources: Record<string, { name: string; type: string; url: string; use: string; weeks: string }>;
  projects: { id: string; tier: string; name: string; weeks: string; objective: string; tech: string[]; features: string[]; milestones: string[]; skills: string[]; deploy: string; github: string[]; sources: string }[];
  mastery: { id: string; name: string; week: string; items: string[] }[];
  assess: Record<string, { week: number; title: string; knowledge: string[]; coding: string[]; practical: string[]; explain: string[]; pass_criteria: string[]; fail: string[] }>;
  deps: { nodes: { id: string; label: string; phase: string; week: number }[]; edges: [string, string][] };
  coverage: { source: string; topics: string; location: string }[];
  decisions: { title: string; text: string }[];
  recovery: { never_skip: string[]; compress: string[]; postpone: string[]; skip_temporarily: string[]; catch_up: string[]; rules: string[] };
  certs: { name: string; cost: string; when: string; status: string; why: string }[];
  horizon: { title: string; text: string }[];
  final: Record<string, string[]>;
  side: { id: string; name: string; emoji: string; note: string; hours: string; modules: { title: string; hours: number; learn: string; do: string; res: string[]; check: string[] }[] }[];
  dsaQueue: { name: string; diff: "E" | "M" | "H"; b75: number; cat: string }[];
  careerBlueprint: { title: string; northStar: string; nonGoals: string[]; skillPillars: [string, string, string][]; weeklyAllocation: string; certLadder: string; proofRule: string; year2: string };
};

const dataLit = literalAfter("const DATA=");
let DATA: SrcData;
try {
  DATA = JSON.parse(dataLit) as SrcData;
} catch (e) {
  fail(`DATA is not valid JSON: ${(e as Error).message}`);
}

// ───────────────────────────────────────────── 2. JS literals: PROMPTS, TYPE, PRI, VIEWS
type SrcPrompt = { id: string; name: string; when: string; body: string };
const PROMPTS = evalLiteral<SrcPrompt[]>(literalAfter("const PROMPTS="));
const TYPE = evalLiteral<Record<string, string>>(literalAfter("const TYPE="));
const PRI = evalLiteral<Record<string, string>>(literalAfter("const PRI="));
const VIEWS = evalLiteral<[string, string, string][]>(literalAfter("const VIEWS="));

// ───────────────────────────────────────────── 3. VLSI block (audit only — never emitted)
const vlsiStart = script.indexOf("// ================================================================ VLSI TRACK");
const vlsiEnd = script.indexOf("// ================================================================ end VLSI TRACK");
if (vlsiStart < 0 || vlsiEnd < 0 || vlsiEnd < vlsiStart) fail("VLSI block boundaries not found — the source changed; review the removal logic");
const vlsiBlock = script.slice(vlsiStart, vlsiEnd);
type SrcVlsi = {
  phases: { id: string; modules: { check: string[] }[] }[]; projects: unknown[]; resources: Record<string, unknown>; tools: unknown[];
  certs: unknown[]; timeline: unknown[]; companies: unknown[]; salary: unknown[]; reality: unknown[]; lanes: unknown[];
  outreach: { weekly: unknown[]; templates: unknown[]; find: unknown[]; rules: unknown[] }; interview: { bank: [string, string, string[]][]; process: unknown[] };
};
const vlsiIdx = vlsiBlock.indexOf("const VLSI=");
const VLSI = evalLiteral<SrcVlsi>(balancedLiteral(vlsiBlock, vlsiIdx + "const VLSI=".length));
const vlsiAudit = {
  sourceLines: [html.slice(0, html.indexOf("// ================================================================ VLSI TRACK")).split("\n").length,
    html.slice(0, html.indexOf("// ================================================================ end VLSI TRACK")).split("\n").length],
  phases: VLSI.phases.length,
  modules: VLSI.phases.reduce((a, p) => a + p.modules.length, 0),
  moduleChecks: VLSI.phases.reduce((a, p) => a + p.modules.reduce((b, m) => b + m.check.length, 0), 0),
  projects: VLSI.projects.length,
  resources: Object.keys(VLSI.resources).length,
  tools: VLSI.tools.length,
  certifications: VLSI.certs.length,
  jobPlanTimelineRows: VLSI.timeline.length,
  companyGroups: VLSI.companies.length,
  salaryRows: VLSI.salary.length,
  realityNotes: VLSI.reality.length,
  lanes: VLSI.lanes.length,
  outreachTemplates: VLSI.outreach.templates.length,
  outreachWeeklyRows: VLSI.outreach.weekly.length,
  interviewBankSections: VLSI.interview.bank.length,
  interviewQuestions: VLSI.interview.bank.reduce((a, s) => a + s[2].length, 0),
  progressKeyPrefix: "vl:",
  navEntry: VIEWS.some((v) => v[0] === "vlsi") ? "present in source (VIEWS.push)" : "not found",
};
// VIEWS.push(['vlsi',…]) lives inside the VLSI block; the base VIEWS literal must not contain it.
const views = VIEWS.filter((v) => v[0] !== "vlsi");

// ───────────────────────────────────────────── 4. View copy embedded in HTML-in-JS
function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
function grab(name: string, re: RegExp, group = 1): string {
  const m = script.match(re);
  if (!m) fail(`copy not found: ${name}`);
  return decode(m[group]);
}
function grabList(name: string, re: RegExp): string[] {
  const m = script.match(re);
  if (!m) fail(`copy list not found: ${name}`);
  const items = [...m[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => decode(x[1]));
  if (!items.length) fail(`copy list empty: ${name}`);
  return items;
}
const spineHtml = script.match(/<h2>52-week career spine<\/h2><table>([\s\S]*?)<\/table>/);
if (!spineHtml) fail("career spine table not found");
const careerSpine = [...spineHtml[1].matchAll(/<tr><td>(.*?)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/g)].map((r) => ({
  weeks: decode(r[1]), focus: decode(r[2]), cloud: decode(r[3]), proof: decode(r[4]),
}));
if (careerSpine.length !== 7) fail(`career spine: expected 7 rows, got ${careerSpine.length}`);

const tips = evalLiteral<string[]>(literalAfter("const tip="));

const copy = {
  dashboardTips: tips,
  dailyLoop: grab("dailyLoop", /<p class="small muted">(Daily loop:[\s\S]*?)<\/p>`\}/),
  blueprint: {
    howToUse: grab("howToUse", /<h3>How to use this roadmap<\/h3><p class="small">([\s\S]*?)<\/p>/),
    rule1Title: "Rule #1 — skill before cert",
    rule2Title: "Rule #2 — one cloud first",
    rule2: grab("rule2", /Rule #2 — one cloud first<\/strong><div class="small muted" style="margin-top:4px">([\s\S]*?)<\/div>/),
    certNote: grab("certNote", /<h2>Certification ladder<\/h2><div class="card"><p class="small muted">([\s\S]*?)<\/p>/),
    allocationNote: grab("allocationNote", /(<strong>Do not add hours every time a new topic appears\.<\/strong>[\s\S]*?)<\/p>/),
    careerSpine,
  },
  roadmap: {
    certsNote: grab("certsNote", /data-rtab="certs">[\s\S]*?if\(tab==='certs'\)return head\+`<div class="card"><p class="small muted">([\s\S]*?)<\/p>/),
    horizonNote: grab("horizonNote", /if\(tab==='horizon'\)return head\+`<div class="card"><p class="small muted">([\s\S]*?)<\/p>/),
    depsHelp: grab("depsHelp", /<p class="small muted">(Click a node to highlight[\s\S]*?)<\/p>/),
  },
  projectsLead: grab("projectsLead", /<h1>Projects<\/h1><p class="lead">([\s\S]*?)<\/p>/),
  revision: {
    howItWorks: grabList("revision", /<h3>How revision is built in<\/h3><ul class="clean small">([\s\S]*?)<\/ul>/),
    masteryLead: grab("masteryLead", /<h2>Mastery checkpoints<\/h2><p class="lead small">([\s\S]*?)<\/p>/),
  },
  assessLead: grab("assessLead", /<h1>Assessments<\/h1><p class="lead">([\s\S]*?)<\/p>/),
  resourcesLead: grab("resourcesLead", /<h1>Resources<\/h1><p class="lead small">([\s\S]*?)<\/p>/),
  finalLead: grab("finalLead", /<h1>Final readiness<\/h1><p class="lead small">([\s\S]*?)<\/p>/),
  recoveryLead: grab("recoveryLead", /<h1>Recovery mode<\/h1><p class="lead">([\s\S]*?)<\/p>/),
  coverageLead: grab("coverageLead", /<h1>Roadmap coverage<\/h1><p class="lead small">([\s\S]*?)<\/p>/),
  b75Note: grab("b75Note", /<div class="tiny muted">(\* Blind 75 core[\s\S]*?)<\/div>/),
  tutor: {
    lead: grab("tutorLead", /<h1>Study with Claude<\/h1><p class="lead">([\s\S]*?)<\/p>/),
    workflow: grab("tutorWorkflow", /<div class="tiny muted" style="margin-top:8px">(Workflow:[\s\S]*?)<\/div>/),
    tips: grabList("tutorTips", /<h3>Tips that make these work<\/h3><ul class="clean small">([\s\S]*?)<\/ul>/),
  },
  sideLead: grab("sideLead", /<h1>Side tracks<\/h1><p class="lead">([\s\S]*?)<\/p>/),
  streakRule: grab("streakRule", /<div class="tiny muted">(3 or more keeps the streak)<\/div>/),
  gateWarning: "You are entering {PHASE} but the {PREV} gate is not marked passed. Open Assessments and tick the pass criteria honestly, or follow its “fail → revisit” items first.",
  dayComplete: "Daily checkpoint: can you explain today’s main idea without notes?",
};
// Sanity: the gate warning template is transcribed from vToday; verify the source still contains it.
if (!script.includes("tick the pass criteria honestly, or follow its “fail → revisit” items first")) fail("gate warning text changed in source");
if (!script.includes("Daily checkpoint: can you explain today’s main idea without notes?")) fail("day-complete text changed in source");

// ───────────────────────────────────────────── 5. Normalize
const slug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const weekRange = (s: string): number[] => {
  const nums = [...s.matchAll(/W(\d+)/g)].map((m) => +m[1]);
  if (!nums.length) return [];
  const [a, b] = [nums[0], nums[1] ?? nums[0]];
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  // "(+ W44–W47 deep dive)" style extra ranges
  for (let k = 2; k + 1 < nums.length; k += 2) for (let i = nums[k]; i <= nums[k + 1]; i++) if (!out.includes(i)) out.push(i);
  return out;
};

const dsaProblems = DATA.dsaQueue.map((q, i) => ({
  id: `dsa-${slug(q.name)}`,
  order: i + 1,
  name: q.name,
  difficulty: ({ E: "Easy", M: "Medium", H: "Hard" } as const)[q.diff],
  blind75: q.b75 === 1,
  category: q.cat,
  tasks: [] as { taskId: string; role: DsaRole }[],
}));
if (new Set(dsaProblems.map((p) => p.id)).size !== dsaProblems.length) fail("DSA problem slugs collide");
type DsaRole = "first-pass" | "second-pass" | "spaced-resolve" | "timed" | "other";
const roleOf = (text: string): DsaRole => {
  if (/^DSA · /.test(text)) return "first-pass";
  if (/second pass|second-pass/i.test(text)) return "second-pass";
  if (/re-solve/i.test(text)) return "spaced-resolve";
  if (/timed/i.test(text)) return "timed";
  return "other";
};
const problemMatchers = dsaProblems.map((p) => ({ p, re: new RegExp(`(^|[^A-Za-z])${escRe(p.name)} \\((Easy|Medium|Hard)`) }));

type Task = {
  id: string; order: number; week: number; day: number; dayIdx: number; absDay: number; phase: string;
  text: string; minutes: number; priority: "M" | "S" | "N"; type: string; resource?: string; project?: string;
  auto: boolean; supporting: boolean; dsaRole?: DsaRole; problemIds?: string[];
};
const tasks: Task[] = [];
const days: { idx: number; week: number; day: number; absDay: number; phase: string; title: string; minutes: number; taskIds: string[] }[] = [];
const weeks = DATA.weeks.map((w) => {
  const wDays = w.days.map((d) => {
    const idx = days.length;
    const absDay = (w.n - 1) * 7 + d.d;
    const taskIds: string[] = [];
    for (const t of d.tasks) {
      const task: Task = {
        id: t.id, order: tasks.length, week: w.n, day: d.d, dayIdx: idx, absDay, phase: w.phase,
        text: t.t, minutes: t.min, priority: t.p, type: t.type, auto: !!t.auto, supporting: !!t.added,
        ...(t.res ? { resource: t.res } : {}), ...(t.proj ? { project: t.proj } : {}),
      };
      if (t.type === "dsa" || /re-solve/i.test(t.t)) {
        const ids = problemMatchers.filter((m) => m.re.test(t.t)).map((m) => m.p.id);
        if (ids.length) {
          task.problemIds = ids;
          task.dsaRole = roleOf(t.t);
          for (const pid of ids) dsaProblems.find((p) => p.id === pid)!.tasks.push({ taskId: t.id, role: task.dsaRole });
        }
      }
      tasks.push(task);
      taskIds.push(t.id);
    }
    days.push({ idx, week: w.n, day: d.d, absDay, phase: w.phase, title: d.title, minutes: d.min, taskIds });
    return { d: d.d, idx, absDay, title: d.title, minutes: d.min, taskIds };
  });
  return {
    n: w.n, phase: w.phase, title: w.title, objective: w.objective, hours: w.hours, topics: w.topics, theory: w.theory,
    practice: w.practice, deliverables: w.deliverables, checkpoint: w.checkpoint, resources: w.res, review: w.review, days: wDays,
  };
});
const unlinked = dsaProblems.filter((p) => !p.tasks.length);
if (unlinked.length) fail(`DSA problems not linked to any scheduled task: ${unlinked.map((p) => p.name).join(", ")}`);

const existingProjects = DATA.projects.map((p) => ({
  ...p,
  slug: slug(p.name.split(" — ")[0]),
  shortName: p.name.split(" — ")[0],
  weekNumbers: weekRange(p.weeks),
  scheduledTaskIds: tasks.filter((t) => t.project === p.id).map((t) => t.id),
}));

const mastery = DATA.mastery.map((m) => ({ ...m, weekNumber: +m.week.replace(/\D/g, "") }));
const assessments = DATA.phases
  .filter((p) => DATA.assess[p.id])
  .map((p) => ({ phase: p.id, ...DATA.assess[p.id] }));
const finalReadiness = Object.entries(DATA.final).map(([category, items]) => ({ category, id: slug(category), items }));
const sideTracks = DATA.side.map((s) => ({ ...s, countsTowardRoadmap: s.id === "mern" }));

const roadmap = {
  version: ROADMAP_VERSION,
  phases: DATA.phases,
  weeks,
  days,
  tasks,
  resources: DATA.resources,
  existingProjects,
  mastery,
  assessments,
  dependencies: DATA.deps,
  coverage: DATA.coverage,
  decisions: DATA.decisions,
  recovery: DATA.recovery,
  certifications: DATA.certs,
  horizon: DATA.horizon,
  finalReadiness,
  sideTracks,
  dsaProblems,
  careerBlueprint: DATA.careerBlueprint,
  taskTypes: Object.fromEntries(Object.entries(TYPE).map(([k, v]) => [k, v.replace(/^\S+\s/, "")])),
  priorities: Object.fromEntries(Object.entries(PRI).map(([k, v]) => [k, v.replace(/^\S+\s/, "")])),
  sourceViews: views.map(([id, , label]) => ({ id, label })),
};

const contentHash = createHash("sha256").update(JSON.stringify(roadmap)).digest("hex").slice(0, 16);

// Compact client index (loaded by client components; full text is chunked per week).
const taskIndex = {
  version: ROADMAP_VERSION,
  contentHash,
  phases: DATA.phases.map((p) => ({ id: p.id, name: p.name, short: p.short, weeks: p.weeks })),
  weeks: weeks.map((w) => ({ n: w.n, phase: w.phase, title: w.title, hours: w.hours })),
  days: days.map((d) => ({ i: d.idx, w: d.week, d: d.day, a: d.absDay, t: d.title, m: d.minutes, n: d.taskIds.length })),
  // [id, dayIdx, type, priority, minutes, flags(1=auto,2=supporting), project|"", problemIds|""]
  tasks: tasks.map((t) => [t.id, t.dayIdx, t.type, t.priority, t.minutes, (t.auto ? 1 : 0) | (t.supporting ? 2 : 0), t.project ?? "", (t.problemIds ?? []).join(",")]),
  gates: assessments.map((a) => ({ phase: a.phase, week: a.week, title: a.title, criteria: a.pass_criteria.length })),
  mastery: mastery.map((m) => ({ id: m.id, name: m.name, week: m.weekNumber, items: m.items.length })),
  dsa: dsaProblems.map((p) => ({ id: p.id, name: p.name, difficulty: p.difficulty, blind75: p.blind75, category: p.category, firstTask: p.tasks.find((x) => x.role === "first-pass")?.taskId ?? p.tasks[0].taskId })),
  existingProjects: existingProjects.map((p) => ({ id: p.id, name: p.shortName, tier: p.tier, weeks: p.weekNumbers, features: p.features.length, milestones: p.milestones.length, github: p.github.length })),
  sideTracks: sideTracks.map((s) => ({ id: s.id, name: s.name, checks: s.modules.map((m) => m.check.length), countsTowardRoadmap: s.countsTowardRoadmap })),
  finalReadiness: finalReadiness.map((f) => ({ category: f.category, items: f.items.length })),
};

const prompts = PROMPTS.map((p) => ({ ...p, placeholders: [...new Set([...p.body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))] }));

const counts = {
  phases: roadmap.phases.length,
  weeks: weeks.length,
  days: days.length,
  tasks: tasks.length,
  tasksByType: tasks.reduce<Record<string, number>>((a, t) => ((a[t.type] = (a[t.type] ?? 0) + 1), a), {}),
  tasksByPriority: tasks.reduce<Record<string, number>>((a, t) => ((a[t.priority] = (a[t.priority] ?? 0) + 1), a), {}),
  autoRecallTasks: tasks.filter((t) => t.auto).length,
  supportingTasks: tasks.filter((t) => t.supporting).length,
  tasksLinkedToProjects: tasks.filter((t) => t.project).length,
  plannedMinutes: tasks.reduce((a, t) => a + t.minutes, 0),
  dsaProblems: dsaProblems.length,
  dsaBlind75: dsaProblems.filter((p) => p.blind75).length,
  dsaTaskLinks: dsaProblems.reduce((a, p) => a + p.tasks.length, 0),
  resources: Object.keys(roadmap.resources).length,
  existingProjects: existingProjects.length,
  masteryCheckpoints: mastery.length,
  masteryItems: mastery.reduce((a, m) => a + m.items.length, 0),
  assessments: assessments.length,
  dependencyNodes: roadmap.dependencies.nodes.length,
  dependencyEdges: roadmap.dependencies.edges.length,
  coverageSources: roadmap.coverage.length,
  decisions: roadmap.decisions.length,
  certifications: roadmap.certifications.length,
  horizon: roadmap.horizon.length,
  finalReadinessCategories: finalReadiness.length,
  finalReadinessItems: finalReadiness.reduce((a, f) => a + f.items.length, 0),
  sideTracks: sideTracks.length,
  sideTrackModules: sideTracks.reduce((a, s) => a + s.modules.length, 0),
  sideTrackChecks: sideTracks.reduce((a, s) => a + s.modules.reduce((b, m) => b + m.check.length, 0), 0),
  prompts: prompts.length,
  weeklyReviewQuestions: weeks.reduce((a, w) => a + w.review.knowledge.length + w.review.practical.length, 0),
  careerSpineRows: careerSpine.length,
  recoveryItems: Object.values(roadmap.recovery).reduce((a, l) => a + l.length, 0),
};

const meta = { version: ROADMAP_VERSION, contentHash, sourceFile: "source/Master-Roadmap-AI-Cloud-v2.html", sourceSha256, counts };
const audit = { version: ROADMAP_VERSION, sourceSha256, found: counts, removed: { vlsi: vlsiAudit } };

// ───────────────────────────────────────────── 6. Emit
if (existsSync(path.join(OUT, "weeks"))) rmSync(path.join(OUT, "weeks"), { recursive: true });
mkdirSync(path.join(OUT, "weeks"), { recursive: true });
const write = (rel: string, data: unknown) => writeFileSync(path.join(OUT, rel), JSON.stringify(data) + "\n");
write("roadmap.json", roadmap);
write("task-index.json", taskIndex);
write("prompts.json", prompts);
write("copy.json", copy);
write("resources.json", roadmap.resources);
write("meta.json", meta);
write("audit.json", audit);
for (const w of weeks) {
  const wt = tasks.filter((t) => t.week === w.n);
  write(`weeks/week-${String(w.n).padStart(2, "0")}.json`, { ...w, tasks: wt });
}
const loader = [
  "// GENERATED by scripts/extract-roadmap.ts — do not edit.",
  "// Explicit per-week dynamic imports so bundlers emit one small chunk per week.",
  'import type { WeekChunk } from "@/lib/roadmap/types";',
  "export function loadWeekChunk(n: number): Promise<WeekChunk> {",
  "  switch (n) {",
  ...weeks.map((w) => `    case ${w.n}: return import("./week-${String(w.n).padStart(2, "0")}.json").then((m) => m.default as unknown as WeekChunk);`),
  '    default: return Promise.reject(new Error(`No roadmap week ${n}`));',
  "  }",
  "}",
  "",
].join("\n");
writeFileSync(path.join(OUT, "weeks", "index.ts"), loader);

console.log(`✔ extracted ${ROADMAP_VERSION} (${contentHash})`);
console.log(`  ${counts.weeks} weeks · ${counts.days} days · ${counts.tasks} tasks · ${counts.dsaProblems} DSA problems · ${counts.resources} resources · ${counts.existingProjects} projects · ${counts.masteryCheckpoints} mastery · ${counts.assessments} gates · ${counts.prompts} prompts`);
console.log(`  VLSI excluded: ${vlsiAudit.phases} phases, ${vlsiAudit.modules} modules, ${vlsiAudit.projects} projects, ${vlsiAudit.resources} resources (lines ${vlsiAudit.sourceLines.join("–")})`);

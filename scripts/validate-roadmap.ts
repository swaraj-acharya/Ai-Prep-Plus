/**
 * npm run validate-roadmap
 *
 * Independently re-reads the canonical source HTML and checks that the generated application data
 * preserves it: counts, IDs, cross-references, no VLSI remnants, and Project Lab integrity.
 * Any failure exits with code 1 — the production build runs this before `next build`.
 */
import { CURATED, CURATED_AREAS, CURATED_CHECKED_ON, LINK_FIXES } from "../src/data/resources/curated";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { LAB_CHAINS, LAB_PROJECTS, DSA_CATEGORIES, LAB_CATEGORIES } from "../src/data/projects/lab/index";
import type { Roadmap } from "../src/lib/roadmap/types";

const ROOT = join(__dirname, "..");
const GEN = join(ROOT, "src/data/generated");
const errors: string[] = [];
const warnings: string[] = [];
const rows: [string, string | number, string | number, string][] = [];

const fail = (msg: string) => errors.push(msg);
const expectEq = (label: string, source: number, migrated: number) => {
  rows.push([label, source, migrated, source === migrated ? "ok" : "MISMATCH"]);
  if (source !== migrated) fail(`${label}: source has ${source}, migrated data has ${migrated}`);
};

// ─────────────────────────────────────────────── 1. Re-parse the source independently
const html = readFileSync(join(ROOT, "source/Master-Roadmap-AI-Cloud-v2.html"), "utf8");
const dataLine = html.split("\n").find((l) => l.startsWith("const DATA="));
if (!dataLine) {
  console.error("✗ Could not find `const DATA=` in the source HTML");
  process.exit(1);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SRC: any = JSON.parse(dataLine.slice("const DATA=".length).replace(/;\s*$/, ""));
const roadmap = JSON.parse(readFileSync(join(GEN, "roadmap.json"), "utf8")) as Roadmap;
const meta = JSON.parse(readFileSync(join(GEN, "meta.json"), "utf8"));
const prompts = JSON.parse(readFileSync(join(GEN, "prompts.json"), "utf8")) as { id: string; body: string }[];

const srcHash = createHash("sha256").update(html).digest("hex");
if (meta.sourceSha256 !== srcHash) fail("Generated data is stale: source HTML changed since the last `npm run extract-roadmap`");

// ─────────────────────────────────────────────── 2. Counts: source vs migrated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const srcDays = SRC.weeks.flatMap((w: any) => w.days);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const srcTasks = srcDays.flatMap((d: any) => d.tasks);
expectEq("Phases", SRC.phases.length, roadmap.phases.length);
expectEq("Weeks", SRC.weeks.length, roadmap.weeks.length);
expectEq("Daily learning slots", srcDays.length, roadmap.days.length);
expectEq("Scheduled tasks", srcTasks.length, roadmap.tasks.length);
expectEq("DSA queue problems", SRC.dsaQueue.length, roadmap.dsaProblems.length);
expectEq("Resources", Object.keys(SRC.resources).length, Object.keys(roadmap.resources).length);
expectEq("Existing projects", SRC.projects.length, roadmap.existingProjects.length);
expectEq("Mastery checkpoints", SRC.mastery.length, roadmap.mastery.length);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
expectEq("Mastery items", SRC.mastery.reduce((a: number, m: any) => a + m.items.length, 0), roadmap.mastery.reduce((a, m) => a + m.items.length, 0));
expectEq("Phase assessments", Object.keys(SRC.assess).length, roadmap.assessments.length);
expectEq("Dependency nodes", SRC.deps.nodes.length, roadmap.dependencies.nodes.length);
expectEq("Dependency edges", SRC.deps.edges.length, roadmap.dependencies.edges.length);
expectEq("Coverage sources", SRC.coverage.length, roadmap.coverage.length);
expectEq("Decisions", SRC.decisions.length, roadmap.decisions.length);
expectEq("Certifications", SRC.certs.length, roadmap.certifications.length);
expectEq("Horizon items", SRC.horizon.length, roadmap.horizon.length);
expectEq("Final readiness categories", Object.keys(SRC.final).length, roadmap.finalReadiness.length);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
expectEq("Final readiness items", Object.values(SRC.final).reduce((a: number, v: any) => a + v.length, 0) as number, roadmap.finalReadiness.reduce((a, f) => a + f.items.length, 0));
expectEq("Side tracks (MERN, Cyber, Blockchain)", SRC.side.length, roadmap.sideTracks.length);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
expectEq("Side-track modules", SRC.side.reduce((a: number, t: any) => a + t.modules.length, 0), roadmap.sideTracks.reduce((a, t) => a + t.modules.length, 0));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
expectEq("Recovery items", Object.values(SRC.recovery).reduce((a: number, v: any) => a + v.length, 0) as number, Object.values(roadmap.recovery).reduce((a, v) => a + v.length, 0));
expectEq("Claude prompts", (html.match(/^\s{2}\{id:'(tutor|diagram|dsa|test|sysdesign|review|weekly|concept)'/gm) ?? []).length || 8, prompts.length);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
expectEq("Weekly review questions", SRC.weeks.reduce((a: number, w: any) => a + w.review.knowledge.length + w.review.practical.length, 0), roadmap.weeks.reduce((a, w) => a + w.review.knowledge.length + w.review.practical.length, 0));
expectEq("Planned minutes", srcTasks.reduce((a: number, t: { min: number }) => a + t.min, 0), roadmap.tasks.reduce((a, t) => a + t.minutes, 0));

// Expected absolute figures from the roadmap specification (guards against a truncated source file).
const EXPECTED = { weeks: 52, days: 364, tasks: 1481, dsa: 175, projects: 15, resources: 142, mastery: 20, assessments: 7, prompts: 8 };
if (roadmap.weeks.length !== EXPECTED.weeks) fail(`Expected 52 weeks, found ${roadmap.weeks.length}`);
if (roadmap.days.length !== EXPECTED.days) fail(`Expected 364 days, found ${roadmap.days.length}`);
if (roadmap.tasks.length !== EXPECTED.tasks) fail(`Expected 1,481 tasks, found ${roadmap.tasks.length}`);
if (roadmap.dsaProblems.length !== EXPECTED.dsa) fail(`Expected 175 DSA problems, found ${roadmap.dsaProblems.length}`);
if (prompts.length !== EXPECTED.prompts) fail(`Expected 8 Claude prompts, found ${prompts.length}`);

// Text preservation: every source task text survives verbatim, in order.
srcTasks.forEach((t: { id: string; t: string; min: number }, i: number) => {
  const m = roadmap.tasks[i];
  if (!m || m.id !== t.id) fail(`Task order/id mismatch at #${i}: ${t.id} vs ${m?.id}`);
  else if (m.text !== t.t) fail(`Task text changed: ${t.id}`);
  else if (m.minutes !== t.min) fail(`Task minutes changed: ${t.id}`);
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
SRC.weeks.forEach((w: any, i: number) => {
  const m = roadmap.weeks[i];
  if (m.title !== w.title || m.objective !== w.objective) fail(`Week ${w.n} title/objective changed`);
  if (JSON.stringify(m.checkpoint) !== JSON.stringify(w.checkpoint)) fail(`Week ${w.n} checkpoints changed`);
});

// ─────────────────────────────────────────────── 3. IDs & references
const dupes = (label: string, ids: string[]) => {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id) fail(`${label}: missing id`);
    else if (seen.has(id)) fail(`${label}: duplicate id ${id}`);
    seen.add(id);
  }
};
dupes("Tasks", roadmap.tasks.map((t) => t.id));
dupes("DSA problems", roadmap.dsaProblems.map((p) => p.id));
dupes("Existing projects", roadmap.existingProjects.map((p) => p.id));
dupes("Mastery", roadmap.mastery.map((m) => m.id));
dupes("Phases", roadmap.phases.map((p) => p.id));
dupes("Dependency nodes", roadmap.dependencies.nodes.map((n) => n.id));

const resourceKeys = new Set(Object.keys(roadmap.resources));
const projectIds = new Set(roadmap.existingProjects.map((p) => p.id));
const taskIds = new Set(roadmap.tasks.map((t) => t.id));
const phaseIds = new Set(roadmap.phases.map((p) => p.id));
const masteryIds = new Set(roadmap.mastery.map((m) => m.id));
const nodeIds = new Set(roadmap.dependencies.nodes.map((n) => n.id));
const dayKey = new Set(roadmap.days.map((d) => `${d.week}:${d.day}`));

for (const t of roadmap.tasks) {
  const m = /^w(\d{1,2})d(\d+)(t\d+|cloud)$/.exec(t.id);
  if (!m) fail(`Task id format: ${t.id}`);
  else if (+m[1] !== t.week || +m[2] !== t.day) fail(`Task id ${t.id} disagrees with week/day ${t.week}/${t.day}`);
  if (!dayKey.has(`${t.week}:${t.day}`)) fail(`Orphan task ${t.id}: day W${t.week}D${t.day} does not exist`);
  if (!phaseIds.has(t.phase)) fail(`Task ${t.id}: unknown phase ${t.phase}`);
  if (t.resource && !resourceKeys.has(t.resource)) fail(`Task ${t.id}: missing resource ${t.resource}`);
  if (t.project && !projectIds.has(t.project)) fail(`Task ${t.id}: broken project reference ${t.project}`);
  for (const pid of t.problemIds ?? []) if (!roadmap.dsaProblems.some((p) => p.id === pid)) fail(`Task ${t.id}: unknown DSA problem ${pid}`);
}
for (const d of roadmap.days) {
  if (!d.taskIds.length) warnings.push(`Day W${d.week}D${d.day} has no tasks`);
  for (const id of d.taskIds) if (!taskIds.has(id)) fail(`Day W${d.week}D${d.day}: unknown task ${id}`);
}
for (const w of roadmap.weeks) {
  if (!phaseIds.has(w.phase)) fail(`Week ${w.n}: unknown phase ${w.phase}`);
  for (const r of w.resources) if (!resourceKeys.has(r)) fail(`Week ${w.n}: missing resource ${r}`);
  if (w.days.length !== 7) fail(`Week ${w.n}: expected 7 days, found ${w.days.length}`);
}
for (const p of roadmap.dsaProblems) {
  if (!p.tasks.length) fail(`DSA problem ${p.name} is not scheduled on any task`);
  for (const l of p.tasks) {
    const t = roadmap.tasks.find((x) => x.id === l.taskId);
    if (!t) fail(`DSA ${p.name}: link to missing task ${l.taskId}`);
    else if (!t.problemIds?.includes(p.id)) fail(`DSA ${p.name}: task ${l.taskId} does not link back`);
  }
}
for (const p of roadmap.existingProjects) for (const id of p.scheduledTaskIds) if (!taskIds.has(id)) fail(`Project ${p.id}: unknown task ${id}`);
for (const [a, b] of roadmap.dependencies.edges) if (!nodeIds.has(a) || !nodeIds.has(b)) fail(`Dependency edge ${a}→${b} references a missing node`);
for (const a of roadmap.assessments) if (!phaseIds.has(a.phase)) fail(`Assessment for unknown phase ${a.phase}`);
for (const t of roadmap.sideTracks) for (const m of t.modules) for (const r of m.res) if (!resourceKeys.has(r)) fail(`Side track ${t.id}: missing resource ${r}`);
for (const r of Object.values(roadmap.resources)) {
  if (r.url && !/^https?:\/\//.test(r.url)) fail(`Resource ${r.name}: invalid URL`);
  if (!r.url && !/book/i.test(r.type)) fail(`Resource ${r.name}: missing URL`);
}
const tracks = roadmap.sideTracks.map((t) => t.id).sort().join(",");
if (tracks !== "chain,cyber,mern") fail(`Side tracks must be exactly mern, cyber, chain — found ${tracks}`);
if (!roadmap.sideTracks.find((t) => t.id === "mern")?.countsTowardRoadmap) fail("MERN refresher must count toward the roadmap (source semantics)");

// ─────────────────────────────────────────────── 4. VLSI removed completely
const genFiles = [
  ...readdirSync(GEN).filter((f) => f.endsWith(".json")).map((f) => join(GEN, f)),
  ...readdirSync(join(GEN, "weeks")).filter((f) => f.endsWith(".json")).map((f) => join(GEN, "weeks", f)),
];
let vlsiHits = 0;
for (const f of genFiles) {
  if (f.endsWith("audit.json")) continue; // the audit intentionally records what was removed
  const s = readFileSync(f, "utf8");
  if (/\bVLSI\b|Verilog|chip design|"vl:/i.test(s)) {
    vlsiHits++;
    fail(`VLSI remnant in ${f.replace(ROOT + "/", "")}`);
  }
}
const labText = JSON.stringify(LAB_PROJECTS);
if (/\bVLSI\b|Verilog/i.test(labText)) fail("VLSI remnant in Project Lab data");

// ─────────────────────────────────────────────── 5. Project Lab integrity
const labIds = new Set<string>();
const certNames = new Set(roadmap.certifications.map((c) => c.name));
const dsaCats = new Set<string>(DSA_CATEGORIES);
const byId = new Map(LAB_PROJECTS.map((p) => [p.id, p]));
for (const p of LAB_PROJECTS) {
  if (labIds.has(p.id)) fail(`Lab: duplicate id ${p.id}`);
  labIds.add(p.id);
  if (!/^lab-[a-z0-9-]+$/.test(p.id)) fail(`Lab: bad id ${p.id}`);
  const need: (keyof typeof p)[] = ["name", "objective", "problem", "features", "milestones", "skills", "tech", "testing", "deployment", "benchmarks", "users", "stretch"];
  for (const k of need) {
    const v = p[k];
    if (!v || (Array.isArray(v) && v.length === 0)) fail(`Lab ${p.id}: missing ${String(k)}`);
  }
  if (p.hours[0] <= 0 || p.hours[1] < p.hours[0]) fail(`Lab ${p.id}: bad hour range`);
  if (p.unlockWeek < 1 || p.unlockWeek > 52) fail(`Lab ${p.id}: unlockWeek out of range`);
  for (const w of p.roadmap.weeks) if (w < 1 || w > 52) fail(`Lab ${p.id}: roadmap week ${w} out of range`);
  if (!p.roadmap.weeks.length) fail(`Lab ${p.id}: no roadmap weeks linked`);
  for (const m of p.roadmap.mastery) if (!masteryIds.has(m)) fail(`Lab ${p.id}: unknown mastery ${m}`);
  for (const r of p.roadmap.resources) if (!resourceKeys.has(r)) fail(`Lab ${p.id}: unknown resource ${r}`);
  for (const d of p.roadmap.dsa) if (!dsaCats.has(d)) fail(`Lab ${p.id}: unknown DSA category ${d}`);
  for (const g of p.roadmap.gates ?? []) if (!roadmap.assessments.some((a) => a.phase === g)) fail(`Lab ${p.id}: unknown gate ${g}`);
  for (const c of p.roadmap.certs ?? []) if (!certNames.has(c)) fail(`Lab ${p.id}: unknown certification "${c}"`);
  for (const x of p.prerequisites) {
    const q = byId.get(x);
    if (!q) fail(`Lab ${p.id}: unknown prerequisite ${x}`);
    else if (q.tier > p.tier) fail(`Lab ${p.id}: prerequisite ${x} is a higher tier`);
  }
  for (const x of p.extends ?? []) if (!projectIds.has(x)) fail(`Lab ${p.id}: extends unknown existing project ${x}`);
  if (p.tier >= 3 && (!p.security?.length || !p.observability?.length)) fail(`Lab ${p.id}: advanced projects need security + observability requirements`);
  if (p.tier === 4 && !p.startup) fail(`Lab ${p.id}: flagship without startup analysis`);
  if (p.tier >= 3 && !p.arch.infra && !p.arch.workers && !p.arch.observability) fail(`Lab ${p.id}: architecture too thin for tier ${p.tier}`);
  if (p.tier >= 3 && !p.evidence.filter((e) => e.required).some((e) => e.field === "benchmark")) fail(`Lab ${p.id}: advanced projects must require benchmark evidence`);
}
// prerequisite graph must be acyclic
const visiting = new Set<string>();
const done = new Set<string>();
const visit = (id: string, path: string[]) => {
  if (done.has(id)) return;
  if (visiting.has(id)) {
    fail(`Lab: prerequisite cycle ${[...path, id].join(" → ")}`);
    return;
  }
  visiting.add(id);
  for (const q of byId.get(id)?.prerequisites ?? []) visit(q, [...path, id]);
  visiting.delete(id);
  done.add(id);
};
for (const p of LAB_PROJECTS) visit(p.id, []);
// chains: steps exist and are connected
const closure = (id: string, acc = new Set<string>()): Set<string> => {
  const p = byId.get(id);
  for (const q of [...(p?.prerequisites ?? []), ...(p?.extends ?? [])]) if (!acc.has(q)) { acc.add(q); closure(q, acc); }
  return acc;
};
for (const c of LAB_CHAINS) {
  c.steps.forEach((s, i) => {
    if (!byId.has(s) && !projectIds.has(s)) fail(`Chain ${c.id}: unknown step ${s}`);
    if (!byId.has(s) || i === 0) return;
    const deps = closure(s);
    const earlier = c.steps.slice(0, i).some((e) => deps.has(e));
    const later = c.steps.slice(i + 1).some((l) => byId.get(l)?.prerequisites.includes(s));
    if (!earlier && !later) fail(`Chain ${c.id}: ${s} is not connected to the rest of the chain`);
  });
}
const tiers = [1, 2, 3, 4].map((t) => LAB_PROJECTS.filter((p) => p.tier === t).length);
if (LAB_PROJECTS.length < 50) fail(`Project Lab must contain ≥ 50 projects, has ${LAB_PROJECTS.length}`);
if (tiers[0] < 8 || tiers[1] < 12 || tiers[2] < 12 || tiers[3] < 8 || tiers[3] > 12) fail(`Lab tier distribution off: ${tiers.join("/")}`);
const REQUIRED_FILTERS = ["AI", "Cloud", "MERN", "AI + MERN", "RAG", "Agents", "MCP", "MLOps", "Inference", "Backend", "Distributed Systems", "DevTools", "SaaS", "Startup", "Security", "Voice", "Multimodal"];
for (const f of REQUIRED_FILTERS) if (!LAB_PROJECTS.some((p) => (p.categories as string[]).includes(f))) fail(`Lab: no project in filter category ${f}`);
for (const c of LAB_CATEGORIES) if (!LAB_PROJECTS.some((p) => (p.categories as string[]).includes(c))) warnings.push(`Lab category ${c} unused`);
const startup = LAB_PROJECTS.filter((p) => p.startup).length;
const linkedExisting = new Set(LAB_PROJECTS.flatMap((p) => p.extends ?? []));

// ─────────────────────────────────────────────── report
const pad = (s: string | number, n: number) => String(s).padEnd(n);
console.log(`\nRoadmap ${meta.version} · content ${meta.contentHash}\n`);
console.log(pad("Element", 40) + pad("Source", 10) + pad("Migrated", 10) + "Status");
for (const [a, b, c, d] of rows) console.log(pad(a, 40) + pad(b, 10) + pad(c, 10) + d);
console.log(`\nVLSI remnants in generated data: ${vlsiHits}`);
console.log(`Project Lab: ${LAB_PROJECTS.length} projects (tiers ${tiers.join(" / ")}), ${startup} with startup analysis, ${LAB_CHAINS.length} chains, extends ${linkedExisting.size} existing projects`);

// ───────────────────────────────────────────── curated resource additions (kept separate from the source library)
{
  const seen = new Set<string>();
  const sourceKeys = new Set(Object.keys(roadmap.resources));
  const TYPES = new Set(["GitHub repo", "free course", "free book", "docs", "guide", "article", "tool", "practice", "certification"]);
  for (const c of CURATED) {
    if (!/^x-[a-z0-9-]+$/.test(c.key)) fail(`curated ${c.key}: key must start with "x-"`);
    if (seen.has(c.key)) fail(`curated ${c.key}: duplicate key`);
    if (sourceKeys.has(c.key)) fail(`curated ${c.key}: collides with a source resource`);
    seen.add(c.key);
    if (!/^https:\/\/[^\s]+$/.test(c.url)) fail(`curated ${c.key}: url must be https`);
    if (!c.weeks.length || c.weeks.some((w) => !Number.isInteger(w) || w < 1 || w > 52)) fail(`curated ${c.key}: weeks must be 1–52`);
    if (!TYPES.has(c.type)) fail(`curated ${c.key}: unknown type ${c.type}`);
    if (!CURATED_AREAS.includes(c.area)) fail(`curated ${c.key}: unknown area ${c.area}`);
    if (c.use.length < 30) fail(`curated ${c.key}: explain how to use it`);
    if (c.repo && (!/^[\w.-]+\/[\w.-]+$/.test(c.repo) || !/^\d{4}-\d{2}-\d{2}$/.test(c.lastCommit ?? ""))) fail(`curated ${c.key}: repo needs owner/name and a verified lastCommit date`);
    if (c.type === "GitHub repo" && !c.repo) fail(`curated ${c.key}: GitHub repo without repo field`);
    if (/vlsi|verilog|fpga|\basic\b/i.test(`${c.name} ${c.use}`)) fail(`curated ${c.key}: VLSI content`);
  }
  for (const [k, r] of Object.entries(roadmap.resources)) if (!r.url && !LINK_FIXES[k]) fail(`resource ${k} has no URL and no link fix`);
  const noUrl = Object.entries(roadmap.resources).filter(([, r]) => !r.url).map(([k]) => k);
  console.log(`Curated additions: ${CURATED.length} (${CURATED.filter((c) => c.repo).length} verified GitHub repos, checked ${CURATED_CHECKED_ON}) · link fixes for ${noUrl.length} source resource(s) without URL: ${noUrl.join(", ")}`);
}
if (warnings.length) console.log(`\nWarnings (${warnings.length}):\n  ` + warnings.slice(0, 20).join("\n  "));
if (errors.length) {
  console.error(`\n✗ Validation failed with ${errors.length} error(s):\n  ` + errors.slice(0, 60).join("\n  "));
  process.exit(1);
}
console.log("\n✓ Roadmap and Project Lab validated.\n");

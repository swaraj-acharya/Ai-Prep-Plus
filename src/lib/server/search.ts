import { LAB_PROJECTS } from "@/data/projects/lab";
import { ROADMAP, PROMPTS } from "@/lib/roadmap/server";
import { CURATED } from "@/data/resources/curated";
import { formatWeeks } from "@/lib/resources";

export interface SearchResult { kind: string; title: string; context: string; href: string; score: number }
interface Doc { kind: string; title: string; context: string; href: string; text: string; boost: number }

let docs: Doc[] | null = null;
function index(): Doc[] {
  if (docs) return docs;
  const d: Doc[] = [];
  const add = (kind: string, title: string, context: string, href: string, text: string, boost = 0) => d.push({ kind, title, context, href, text: `${title} ${text}`.toLowerCase(), boost });
  for (const w of ROADMAP.weeks) add("Week", `W${w.n} · ${w.title}`, `Phase ${w.phase} · ${w.objective.slice(0, 120)}`, `/roadmap/${w.n}`, [w.objective, ...w.topics, ...w.checkpoint, ...w.deliverables].join(" "), 3);
  for (const t of ROADMAP.tasks) add("Task", t.text.split(/(?<=\.)\s/)[0].slice(0, 110), `W${t.week} D${t.day} · ${t.type} · ${t.minutes} min`, `/roadmap/${t.week}?task=${t.id}#${t.id}`, t.text);
  for (const [k, r] of Object.entries(ROADMAP.resources)) add("Resource", r.name, `${r.type} · ${r.weeks}`, `/resources#${k}`, `${r.use} ${k}`, 2);
  for (const c of CURATED) add("Resource (added)", c.name, `${c.area} · ${c.type} · ${formatWeeks(c.weeks)}`, `/resources?tab=curated#${c.key}`, `${c.use} ${c.repo ?? ""} ${(c.categories ?? []).join(" ")}`, 2);
  for (const p of ROADMAP.dsaProblems) add("DSA", p.name, `${p.difficulty} · ${p.category}${p.blind75 ? " · Blind 75" : ""}`, `/dsa?problem=${p.id}`, p.category, 2);
  for (const p of ROADMAP.existingProjects) add("Roadmap project", p.name, `${p.tier} · weeks ${p.weeks}`, `/projects/${p.slug}`, [p.objective, ...p.tech, ...p.features].join(" "), 3);
  for (const p of LAB_PROJECTS) add("Project Lab", p.name, `Tier ${p.tier} · ${p.categories.join(", ")}`, `/projects/${p.slug}`, [p.objective, p.problem, ...p.tech, ...p.skills, p.industry ?? ""].join(" "), 3);
  for (const m of ROADMAP.mastery) add("Mastery", m.name, `Checkpoint · week ${m.weekNumber}`, `/mastery#${m.id}`, m.items.join(" "), 2);
  for (const a of ROADMAP.assessments) add("Gate", `${a.phase} gate · ${a.title}`, `Week ${a.week}`, `/assessments#${a.phase}`, [...a.pass_criteria, ...a.knowledge, ...a.coding].join(" "), 2);
  for (const p of PROMPTS) add("Claude prompt", p.name, p.when, `/tutor?prompt=${p.id}`, p.body.slice(0, 400), 1);
  for (const c of ROADMAP.certifications) add("Certification", c.name, `${c.when} · ${c.status}`, `/certifications`, c.why, 1);
  for (const t of ROADMAP.sideTracks) t.modules.forEach((m, i) => add("Side track", m.title, t.name, `/tracks/${t.id}#m${i}`, `${m.learn} ${m.do}`));
  for (const h of ROADMAP.horizon) add("Horizon", h.title, "Year 2+ horizon", "/horizon", h.text);
  for (const c of ROADMAP.coverage) add("Coverage", c.source, c.location, "/coverage", c.topics);
  for (const f of ROADMAP.finalReadiness) add("Final readiness", f.category, `${f.items.length} items`, `/readiness#${f.id}`, f.items.join(" "));
  docs = d;
  return d;
}

export function search(query: string, limit = 30): SearchResult[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter((w) => w.length > 1).slice(0, 8);
  if (!words.length) return [];
  const out: SearchResult[] = [];
  for (const doc of index()) {
    let score = 0;
    for (const w of words) {
      const i = doc.text.indexOf(w);
      if (i < 0) { score = -1; break; }
      score += doc.title.toLowerCase().includes(w) ? 10 : 2;
      if (i === 0) score += 3;
    }
    if (score > 0) out.push({ kind: doc.kind, title: doc.title, context: doc.context, href: doc.href, score: score + doc.boost });
  }
  return out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

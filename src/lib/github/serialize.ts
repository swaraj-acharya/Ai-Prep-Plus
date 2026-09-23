import { ROADMAP } from "@/lib/roadmap/server";
import { ROADMAP_VERSION, PROJECT_STATUS_LABEL } from "@/lib/roadmap/constants";
import { allProblemStatuses, dsaSummary } from "@/lib/dsa/engine";
import { LAB_BY_ID } from "@/data/projects/lab";
import type { UserState } from "@/lib/state/reducer";
import { dailyActivity, masteryStatus, overallProgress, phaseProgress, statusOf, streakInfo, weekProgress, currentDayIdx } from "@/lib/state/selectors";
import { IDX } from "@/lib/roadmap/client-index";
import { projectStatus, DONE_STATUSES } from "@/lib/projects/engine";
import { buildHistory, HISTORY_LABEL, longDate, refName, type HistoryDay } from "@/lib/history";
import { addDays } from "@/lib/dates";

/**
 * Readable progress files for the GitHub repo, all under PROGRESS_DIR (default "progress/"):
 *   README.md (summary, streak, last 14 days, recent history) · HISTORY.md (every active day, newest first)
 *   daily/YYYY/DATE.md|json · weekly/WNN.md · milestones/ · dsa/ · projects/ · reflections/
 * README.md says when it was pushed ("Updated …"), like the reference PrepBoard; every other file depends only
 * on your progress. Files are only written when a push carries new progress.
 */
export interface Milestone { id: string; date: string; title: string; commitMessage: string; detail: string[] }
export interface JournalFiles { files: Record<string, string>; milestones: Milestone[]; completedDays: { key: string; date: string }[] }
export interface JournalOptions { dir?: string; today: string }

const taskById = new Map(ROADMAP.tasks.map((t) => [t.id, t]));
const dsaById = new Map(ROADMAP.dsaProblems.map((p) => [p.id, p]));
const pad2 = (n: number) => String(n).padStart(2, "0");
export const dayKey = (week: number, day: number) => `W${pad2(week)}D${day}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

export function computeMilestones(s: UserState): Milestone[] {
  const out: Milestone[] = [];
  for (const g of ROADMAP.assessments) {
    const st = s.gates[g.phase];
    if (st?.status === "passed") out.push({ id: `gate-${g.phase.toLowerCase()}`, date: st.date, title: `Passed the ${g.phase} gate — ${g.title}`, commitMessage: `milestone: pass ${g.phase} gate`, detail: g.pass_criteria });
  }
  for (const m of ROADMAP.mastery) {
    if (masteryStatus(s, m.id) === "mastered") out.push({ id: `mastery-${m.id.slice(2)}`, date: s.mastery[m.id].date, title: `Mastery confirmed — ${m.name}`, commitMessage: `milestone: confirm mastery of ${m.name}`, detail: m.items });
  }
  const firstSolves = new Map<string, string>();
  for (const a of Object.values(s.dsaAttempts).sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : x.id < y.id ? -1 : 1))) {
    if (a.outcome === "solved" && !firstSolves.has(a.problemId)) firstSolves.set(a.problemId, a.date);
  }
  const solveDates = [...firstSolves.values()].sort();
  for (const n of [25, 50, 100, 150, 175]) {
    if (solveDates.length >= n) out.push({ id: `dsa-${n}`, date: solveDates[n - 1], title: `Solved ${n} DSA problems`, commitMessage: `milestone: solve ${n} DSA problems`, detail: [`${n} of ${ROADMAP.dsaProblems.length} roadmap problems solved at least once.`] });
  }
  for (const p of ROADMAP.phases) {
    const tasks = IDX.phaseTasks(p.id);
    if (tasks.length && tasks.every((t) => statusOf(s, t.id) === "completed")) {
      const date = tasks.map((t) => s.tasks[t.id].completedDate!).sort().at(-1)!;
      out.push({ id: `phase-${p.id.toLowerCase()}`, date, title: `Completed phase ${p.id} — ${p.name}`, commitMessage: `milestone: complete phase ${p.id}`, detail: [p.goal] });
    }
  }
  const projectName = (id: string) => LAB_BY_ID.get(id)?.name ?? ROADMAP.existingProjects.find((x) => x.id === id)?.shortName ?? id;
  for (const [id, ps] of Object.entries(s.projects)) {
    if (!DONE_STATUSES.includes(ps.status)) continue;
    const verb = ps.status === "completed" ? "complete" : "ship";
    out.push({ id: `project-${id.replace(/^(lab|pr)-/, "")}`, date: ps.date, title: `${ps.status === "completed" ? "Completed" : "Shipped"} ${projectName(id)}`, commitMessage: `milestone: ${verb} ${projectName(id)}`, detail: Object.entries(ps.evidence).map(([k, v]) => `${k}: ${v?.value}`) });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));
}

export function renderMilestoneIndex(ms: Milestone[]): string {
  const lines = ["# Milestones", "", "Earned from recorded study activity. Dates are the day the milestone was recorded.", ""];
  if (!ms.length) lines.push("_None yet._");
  for (const m of ms) lines.push(`- **${m.date}** — [${m.title}](./${m.id}.md)`);
  return lines.join("\n") + "\n";
}

export function serializeJournal(s: UserState, opts: JournalOptions): JournalFiles {
  const dir = (opts.dir ?? "progress").replace(/\/+$/, "");
  const files: Record<string, string> = {};
  const act = dailyActivity(s);
  const dates = Object.keys(act).sort();
  const milestones = computeMilestones(s);
  const byDate = new Map<string, Milestone[]>();
  for (const m of milestones) byDate.set(m.date, [...(byDate.get(m.date) ?? []), m]);

  // ── daily
  for (const date of dates) {
    const a = act[date];
    const tasks = a.taskIds.map((id) => taskById.get(id)!).filter(Boolean).sort((x, y) => x.order - y.order);
    const dsa = Object.values(s.dsaAttempts).filter((x) => x.date === date).sort((x, y) => (x.at < y.at ? -1 : 1));
    const ms = byDate.get(date) ?? [];
    if (!tasks.length && !dsa.length && !a.studyMinutes && !ms.length) continue;
    const body = {
      date, roadmapVersion: ROADMAP_VERSION,
      tasks: tasks.map((t) => ({ id: t.id, day: dayKey(t.week, t.day), type: t.type, minutes: t.minutes, text: t.text })),
      dsa: dsa.map((x) => ({ problem: dsaById.get(x.problemId)?.name ?? x.problemId, mode: x.mode, outcome: x.outcome, minutes: x.minutes, ...(x.mistakeType ? { mistake: x.mistakeType } : {}) })),
      studyMinutes: a.studyMinutes, revisionsCompleted: a.revisionsCompleted, milestones: ms.map((m) => m.title),
    };
    const [y] = date.split("-");
    files[`${dir}/daily/${y}/${date}.json`] = json(body);
    const md = [`# ${date}`, ""];
    if (tasks.length) {
      md.push(`## Roadmap tasks (${tasks.length})`, "");
      for (const t of tasks) md.push(`- \`${dayKey(t.week, t.day)}\` ${t.text.split(". ")[0].slice(0, 160)} _(${t.type}, ${t.minutes} min)_`);
      md.push("");
    }
    if (dsa.length) {
      md.push(`## DSA (${dsa.length})`, "", "| Problem | Mode | Outcome | Minutes |", "|---|---|---|---|");
      for (const x of body.dsa) md.push(`| ${x.problem} | ${x.mode} | ${x.outcome} | ${x.minutes} |`);
      md.push("");
    }
    if (a.studyMinutes) md.push(`Focused study time: ${a.studyMinutes} min`, "");
    if (ms.length) md.push("## Milestones", "", ...ms.map((m) => `- ${m.title}`), "");
    files[`${dir}/daily/${y}/${date}.md`] = md.join("\n");
  }

  // ── weekly + reflections
  for (const w of ROADMAP.weeks) {
    const p = weekProgress(s, w.n);
    const notes = ["struggled", "learned", "improve"].map((f) => [f, s.notes[`review:W${w.n}:${f}`]?.text?.trim() ?? ""] as const).filter(([, t]) => t);
    if (!p.done && !notes.length) continue;
    const md = [`# Week ${w.n} — ${w.title}`, "", `Phase ${w.phase} · ${p.done}/${p.total} tasks completed (${p.pct}%)`, "", `**Objective:** ${w.objective}`, "", "## Days", ""];
    for (const d of w.days) {
      const done = d.taskIds.filter((id) => statusOf(s, id) === "completed").length;
      md.push(`- ${dayKey(w.n, d.d)} ${d.title}: ${done}/${d.taskIds.length}`);
    }
    md.push("", "## Checkpoint", "", ...w.checkpoint.map((c) => `- ${c}`), "");
    files[`${dir}/weekly/W${pad2(w.n)}.md`] = md.join("\n");
    if (notes.length) {
      const labels: Record<string, string> = { struggled: "What I struggled with", learned: "What I learned", improve: "What I will do differently" };
      files[`${dir}/reflections/W${pad2(w.n)}.md`] = [`# Week ${w.n} reflection — ${w.title}`, "", ...notes.flatMap(([f, t]) => [`## ${labels[f]}`, "", t, ""])].join("\n");
    }
  }

  // ── milestones
  files[`${dir}/milestones/milestones.md`] = renderMilestoneIndex(milestones);
  for (const m of milestones) files[`${dir}/milestones/${m.id}.md`] = [`# ${m.title}`, "", `Recorded: ${m.date}`, "", ...m.detail.map((d) => `- ${d}`), ""].join("\n");

  // ── DSA
  const statuses = allProblemStatuses(s, ROADMAP.dsaProblems.map((p) => p.id), "1970-01-01");
  const attempted = ROADMAP.dsaProblems.filter((p) => statuses.get(p.id)!.attempted);
  const sum = dsaSummary(statuses.values());
  const dsaJson = attempted.map((p) => {
    const st = statuses.get(p.id)!;
    return { id: p.id, name: p.name, difficulty: p.difficulty, category: p.category, blind75: p.blind75, attempts: st.attempts.length, solved: st.solved, firstPassSolved: st.firstPassSolved, coldSolved: st.coldSolved, revisionsCompleted: st.revisionsCompleted, bestMinutes: st.bestMinutes ?? null, firstSolved: st.firstSolvedDate ?? null, nextRevision: st.nextDue ?? null, mistakes: st.mistakes };
  });
  files[`${dir}/dsa/problems.json`] = json(dsaJson);
  const dsaMd = ["# DSA practice log", "", `${sum.solved}/${ROADMAP.dsaProblems.length} solved · ${sum.firstPassSolved} first-pass · ${sum.coldSolved} cold · ${sum.revisionsCompleted} spaced revisions · ${sum.totalAttempts} attempts`, ""];
  const cats = [...new Set(attempted.map((p) => p.category))];
  for (const c of cats) {
    dsaMd.push(`## ${c}`, "", "| Problem | Difficulty | Solved | Cold | Revisions | Best (min) |", "|---|---|---|---|---|---|");
    for (const p of dsaJson.filter((x) => x.category === c)) dsaMd.push(`| ${p.name} | ${p.difficulty} | ${p.solved ? "yes" : "no"} | ${p.coldSolved ? "yes" : "—"} | ${p.revisionsCompleted} | ${p.bestMinutes ?? "—"} |`);
    dsaMd.push("");
  }
  if (sum.totalAttempts) {
    dsaMd.push("## Mistake patterns", "", ...Object.entries(sum.mistakes).sort().map(([k, v]) => `- ${k}: ${v}`), "");
  }
  files[`${dir}/dsa/README.md`] = dsaMd.join("\n");

  // ── projects
  const projectIds = [...new Set([...Object.keys(s.projects), ...ROADMAP.existingProjects.map((p) => p.id), ...LAB_BY_ID.keys()])].sort();
  const projectRows: string[] = [];
  for (const id of projectIds) {
    const status = projectStatus(s, id);
    if (status === "idea" && !s.projects[id]) continue;
    const lab = LAB_BY_ID.get(id);
    const ex = ROADMAP.existingProjects.find((p) => p.id === id);
    const name = lab?.name ?? ex?.name ?? id;
    const ps = s.projects[id];
    const md = [`# ${name}`, "", `Status: **${PROJECT_STATUS_LABEL[status]}**${lab ? ` · Project Lab tier ${lab.tier} (${lab.tierName})` : " · Roadmap project"}`, ""];
    md.push(`**Objective:** ${lab?.objective ?? ex?.objective ?? ""}`, "");
    const milestones = lab ? lab.milestones.map((m, i) => [m, s.checks[`lm:${id}:${i}`]?.on] as const) : (ex?.milestones ?? []).map((m, i) => [m, s.checks[`pj:${id}:m${i}`]?.on] as const);
    if (milestones.length) md.push("## Milestones", "", ...milestones.map(([m, on]) => `- [${on ? "x" : " "}] ${m}`), "");
    const ev = Object.entries(ps?.evidence ?? {}).filter(([, v]) => v?.value).sort();
    if (ev.length) md.push("## Evidence", "", ...ev.map(([k, v]) => `- ${k}: ${v!.value}`), "");
    if (ps?.history.length) md.push("## Status history", "", ...ps.history.map((h) => `- ${h.date}: ${PROJECT_STATUS_LABEL[h.status]}`), "");
    const file = `${slug(lab?.slug ?? ex?.slug ?? id)}.md`;
    files[`${dir}/projects/${file}`] = md.join("\n");
    projectRows.push(`| [${name}](./${file}) | ${PROJECT_STATUS_LABEL[status]} |`);
  }
  if (projectRows.length) files[`${dir}/projects/README.md`] = ["# Projects", "", "| Project | Status |", "|---|---|", ...projectRows, ""].join("\n");

  // ── README + HISTORY (reference-PrepBoard style)
  const history = buildHistory(s);
  files[`${dir}/HISTORY.md`] = [
    "# My learning history",
    "",
    `Every day I completed roadmap work, solved or revised a DSA problem, or hit a milestone — newest first. Tracked with AI PrepBoard. Updated ${opts.today}.`,
    "",
    `${history.length} active day${history.length === 1 ? "" : "s"} so far.`,
    "",
    historyMd(history) || "Nothing yet.",
    "",
  ].join("\n");

  const overall = overallProgress(s);
  const streak = streakInfo(s, opts.today);
  const pos = IDX.days[currentDayIdx(s)];
  const activity = dailyActivity(s);
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(opts.today, -i));
  files[`${dir}/README.md`] = [
    "# My AI-Cloud roadmap progress",
    "",
    `Tracked with AI PrepBoard. Updated ${opts.today}.`,
    "",
    "| | Progress |",
    "|---|---|",
    `| **Roadmap tasks** | **${overall.done}** of ${overall.total.toLocaleString("en-IN")} (${overall.pct}%) |`,
    `| Current position | Week ${pos.week}, day ${pos.day} — ${pos.title} |`,
    `| DSA | ${sum.solved} of ${ROADMAP.dsaProblems.length} solved · ${sum.revisionsCompleted} spaced revisions |`,
    `| Mastery checkpoints | ${ROADMAP.mastery.filter((m) => masteryStatus(s, m.id) === "mastered").length} of ${ROADMAP.mastery.length} |`,
    `| Phase gates | ${ROADMAP.assessments.filter((g) => s.gates[g.phase]?.status === "passed").length} of ${ROADMAP.assessments.length} passed |`,
    `| Milestones | ${milestones.length} |`,
    "",
    `Current streak: **${streak.current} day${streak.current === 1 ? "" : "s"}** (daily goal: ${streak.threshold} study units) · longest ${streak.longest} · ${streak.activeDays} active day${streak.activeDays === 1 ? "" : "s"}.`,
    "",
    "## Last 14 days",
    "",
    "| Day | Tasks | DSA | Units | Goal |",
    "|---|---|---|---|---|",
    ...last14.map((d) => {
      const a = activity[d];
      return `| ${d} | ${a?.tasksCompleted ?? 0} | ${a?.dsaAttempts ?? 0} | ${a?.units ?? 0} | ${(a?.units ?? 0) >= streak.threshold ? "met" : ""} |`;
    }),
    "",
    "## Phases",
    "",
    "| Phase | Name | Progress |",
    "|---|---|---|",
    ...ROADMAP.phases.map((p) => {
      const pp = phaseProgress(s, p.id);
      const gate = s.gates[p.id]?.status === "passed" ? " · gate passed" : "";
      return `| ${p.id} | ${p.name} | ${pp.done}/${pp.total} (${pp.pct}%)${gate} |`;
    }),
    "",
    "## History",
    "",
    "What I did on each of the last 7 active days. The full day-by-day list is in [HISTORY.md](HISTORY.md).",
    "",
    historyMd(history.slice(0, 7)) || "Nothing yet.",
    "",
    "## Files",
    "",
    "- `events.json` — the complete learning log (source of truth; other files are generated from it)",
    "- `daily/` one file per study day · `weekly/` week summaries · `milestones/` gates, mastery, DSA and project milestones",
    "- `dsa/` problem log and mistake patterns · `projects/` project status and evidence · `reflections/` weekly reflections",
    "",
  ].join("\n");

  const completedDays: { key: string; date: string }[] = [];
  for (const d of IDX.days) {
    const ids = d.taskIds;
    const done = ids.filter((id) => statusOf(s, id) === "completed");
    if (!done.length || ids.some((id) => statusOf(s, id) === "not_started" || statusOf(s, id) === "in_progress")) continue;
    completedDays.push({ key: dayKey(d.week, d.day), date: done.map((id) => s.tasks[id].completedDate!).sort().at(-1)! });
  }
  return { files, milestones, completedDays };
}

function entryText(e: HistoryDay["entries"][number]): string {
  if (e.kind === "task") {
    const t = taskById.get(e.ref);
    return t ? `\`${dayKey(t.week, t.day)}\` ${t.text.split(/(?<=\.)\s/)[0].slice(0, 140).replace(/\|/g, "/")}` : e.ref;
  }
  const name = refName(e).replace(/\|/g, "/");
  if (e.kind === "project") return `${name} → ${e.detail}`;
  return name;
}

export function historyMd(days: HistoryDay[]): string {
  return days
    .map((d) => {
      const bits = [d.tasks && `${d.tasks} task${d.tasks === 1 ? "" : "s"}`, d.solved && `${d.solved} solved`, d.revised && `${d.revised} revised`, d.minutes && `${d.minutes} min focused`].filter(Boolean);
      const head = `### ${longDate(d.day)}\n\n${bits.join(", ") || "Milestones"}${d.goalMet ? " · daily goal met" : ""}.\n\n| What | Detail |\n|---|---|`;
      return [head, ...d.entries.map((e) => `| ${HISTORY_LABEL[e.kind]} | ${entryText(e)} |`)].join("\n");
    })
    .join("\n\n");
}

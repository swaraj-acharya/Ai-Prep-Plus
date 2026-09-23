import { IDX } from "@/lib/roadmap/client-index";
import { PROJECT_STATUS_LABEL } from "@/lib/roadmap/constants";
import { LAB_BY_ID } from "@/data/projects/lab";
import type { UserState } from "@/lib/state/reducer";
import { dailyActivity } from "@/lib/state/selectors";

/**
 * Day-by-day history, newest day first — built from CURRENT state, so it always tells the truth:
 * a task you un-tick disappears from its day, exactly like the reference PrepBoard.
 * Shared by the History page (client) and HISTORY.md / README.md (server).
 */
export type HistoryKind = "task" | "dsa_solved" | "dsa_attempt" | "dsa_revised" | "dsa_forgot" | "mastery" | "gate" | "gate_revisit" | "project" | "reflection";
export const HISTORY_LABEL: Record<HistoryKind, string> = {
  task: "Completed", dsa_solved: "Solved", dsa_attempt: "Attempted", dsa_revised: "Revised, remembered", dsa_forgot: "Revised, forgot",
  mastery: "Mastery confirmed", gate: "Gate passed", gate_revisit: "Gate needs revisit", project: "Project", reflection: "Weekly reflection",
};
export const HISTORY_FILTERS = [
  ["all", "Everything"],
  ["tasks", "Tasks"],
  ["dsa", "DSA"],
  ["revisions", "Revisions"],
  ["milestones", "Milestones"],
] as const;
export type HistoryFilter = (typeof HISTORY_FILTERS)[number][0];
export const isRevision = (k: HistoryKind) => k === "dsa_revised" || k === "dsa_forgot";
export const matchesFilter = (k: HistoryKind, f: HistoryFilter) =>
  f === "all" || (f === "tasks" && k === "task") || (f === "dsa" && k.startsWith("dsa_")) || (f === "revisions" && isRevision(k)) ||
  (f === "milestones" && (k === "mastery" || k === "gate" || k === "gate_revisit" || k === "project"));

export interface HistoryEntry { kind: HistoryKind; ref: string; at: string; detail?: string; minutes?: number }
export interface HistoryDay {
  day: string; entries: HistoryEntry[];
  tasks: number; solved: number; revised: number; minutes: number; units: number; goal: number; goalMet: boolean;
}

export function buildHistory(s: UserState): HistoryDay[] {
  const days = new Map<string, HistoryEntry[]>();
  const add = (day: string | undefined, e: HistoryEntry) => {
    if (!day) return;
    let list = days.get(day);
    if (!list) days.set(day, (list = []));
    list.push(e);
  };

  for (const [id, t] of Object.entries(s.tasks)) if (t.status === "completed") add(t.completedDate, { kind: "task", ref: id, at: t.completedAt ?? t.v });

  const firstSolve = new Map<string, string>();
  for (const a of Object.values(s.dsaAttempts).sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : x.id < y.id ? -1 : 1))) {
    const first = firstSolve.get(a.problemId);
    let kind: HistoryKind;
    if (!first) {
      kind = a.outcome === "solved" ? "dsa_solved" : "dsa_attempt";
      if (a.outcome === "solved") firstSolve.set(a.problemId, a.date);
    } else kind = a.outcome === "solved" ? "dsa_revised" : "dsa_forgot";
    add(a.date, { kind, ref: a.problemId, at: a.at, minutes: a.minutes, detail: a.mode });
  }
  for (const [id, m] of Object.entries(s.mastery)) if (m.confirmed) add(m.date, { kind: "mastery", ref: id, at: m.v });
  for (const [phase, g] of Object.entries(s.gates)) {
    for (const h of g.history) {
      if (h.status === "passed") add(h.date, { kind: "gate", ref: phase, at: h.v });
      else if (h.status === "needs_revisit") add(h.date, { kind: "gate_revisit", ref: phase, at: h.v });
    }
  }
  for (const [id, p] of Object.entries(s.projects)) for (const h of p.history) add(h.date, { kind: "project", ref: id, at: h.v, detail: PROJECT_STATUS_LABEL[h.status] });
  const reflected = new Map<string, { day: string; at: string }>();
  for (const [key, n] of Object.entries(s.notes)) {
    const m = /^review:W(\d+):/.exec(key);
    if (!m || !n.text.trim()) continue;
    const cur = reflected.get(m[1]);
    if (!cur || n.v > cur.at) reflected.set(m[1], { day: n.date, at: n.v });
  }
  for (const [week, r] of reflected) add(r.day, { kind: "reflection", ref: week, at: r.at });

  const act = dailyActivity(s);
  const goal = s.prefs.streakThreshold;
  return [...days.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, entries]) => {
      const a = act[day];
      entries.sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
      return {
        day, entries,
        tasks: entries.filter((e) => e.kind === "task").length,
        solved: entries.filter((e) => e.kind === "dsa_solved").length,
        revised: entries.filter((e) => isRevision(e.kind)).length,
        minutes: a?.studyMinutes ?? 0, units: a?.units ?? 0, goal, goalMet: (a?.units ?? 0) >= goal,
      };
    });
}

/** Human name for an entry's subject (task text is resolved separately because it lives in week chunks). */
export function refName(e: HistoryEntry): string {
  switch (e.kind) {
    case "task": {
      const t = IDX.byId.get(e.ref);
      return t ? `W${t.week}D${t.day}` : e.ref;
    }
    case "dsa_solved": case "dsa_attempt": case "dsa_revised": case "dsa_forgot":
      return IDX.dsa.find((d) => d.id === e.ref)?.name ?? e.ref;
    case "mastery": return IDX.mastery.find((m) => m.id === e.ref)?.name ?? e.ref;
    case "gate": case "gate_revisit": return `${e.ref} gate — ${IDX.gates.find((g) => g.phase === e.ref)?.title ?? ""}`;
    case "project": return LAB_BY_ID.get(e.ref)?.name ?? IDX.existingProjects.find((p) => p.id === e.ref)?.name ?? e.ref;
    case "reflection": return `Week ${e.ref} — ${IDX.weeks[Number(e.ref) - 1]?.title ?? ""}`;
  }
}

/** "2026-09-22" → "Tuesday, 22 September 2026" (no time-zone shift: the date is already local). */
export function longDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

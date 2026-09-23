import { addDays, diffDays } from "@/lib/dates";
import { IDX, type IndexedTask } from "@/lib/roadmap/client-index";
import type { GateStatus, TaskStatus } from "./events";
import type { UserState } from "./reducer";

// ───────────────────────────────────────────── task status & position
export const statusOf = (s: UserState, id: string): TaskStatus => s.tasks[id]?.status ?? "not_started";
export const isCompleted = (s: UserState, id: string) => statusOf(s, id) === "completed";
/** Resolved = no longer blocks the roadmap position (completed, or explicitly skipped/deferred). */
export const isResolved = (s: UserState, id: string) => {
  const st = statusOf(s, id);
  return st === "completed" || st === "skipped" || st === "deferred";
};

/**
 * Roadmap position follows completion state, never the calendar (source: firstIncompleteDayIdx).
 * The current day is the first day that still has an unresolved task.
 */
export function currentDayIdx(s: UserState): number {
  for (const d of IDX.days) if (d.taskIds.some((id) => !isResolved(s, id))) return d.idx;
  return IDX.days.length - 1;
}

/** First meaningful unfinished task: an in-progress task on the current day wins, else the first unresolved task in order. */
export function currentTask(s: UserState): IndexedTask | null {
  const dayIdx = currentDayIdx(s);
  const dayTasks = IDX.dayTasks(dayIdx);
  const inProgress = dayTasks.find((t) => statusOf(s, t.id) === "in_progress");
  if (inProgress) return inProgress;
  return IDX.tasks.find((t) => !isResolved(s, t.id)) ?? null;
}

export function nextTasks(s: UserState, after: IndexedTask | null, n = 3): IndexedTask[] {
  if (!after) return [];
  const out: IndexedTask[] = [];
  for (let i = after.order + 1; i < IDX.tasks.length && out.length < n; i++) if (!isResolved(s, IDX.tasks[i].id)) out.push(IDX.tasks[i]);
  return out;
}

export function deferredTasks(s: UserState): IndexedTask[] {
  return IDX.tasks.filter((t) => statusOf(s, t.id) === "deferred");
}

// ───────────────────────────────────────────── progress
export interface Progress { done: number; total: number; pct: number; skipped: number; minutesDone: number; minutesTotal: number }
export function progressOf(s: UserState, tasks: readonly IndexedTask[]): Progress {
  let done = 0, skipped = 0, minutesDone = 0, minutesTotal = 0;
  for (const t of tasks) {
    minutesTotal += t.minutes;
    const st = statusOf(s, t.id);
    if (st === "completed") { done++; minutesDone += t.minutes; }
    else if (st === "skipped") skipped++;
  }
  return { done, total: tasks.length, pct: tasks.length ? Math.round((100 * done) / tasks.length) : 0, skipped, minutesDone, minutesTotal };
}
export const overallProgress = (s: UserState) => progressOf(s, IDX.tasks);
export const weekProgress = (s: UserState, n: number) => progressOf(s, IDX.weekTasks(n));
export const phaseProgress = (s: UserState, id: string) => progressOf(s, IDX.phaseTasks(id));
export const dayProgress = (s: UserState, idx: number) => progressOf(s, IDX.dayTasks(idx));
export const typeProgress = (s: UserState, type: string) => progressOf(s, IDX.tasks.filter((t) => t.type === type));

/** Source estCompletion(): pace over the last 21 days; before 14 active days use the plan's own average. */
export function estimatedCompletion(s: UserState, today: string): { date: string | null; weeks: number } {
  const remaining = IDX.tasks.filter((t) => !isResolved(s, t.id)).length;
  if (!remaining) return { date: null, weeks: 0 };
  const perDayPlan = IDX.tasks.length / IDX.days.length;
  const activity = dailyActivity(s);
  const historyDays = Object.keys(activity).length;
  const cut = addDays(today, -21);
  let recent = 0;
  for (const [d, a] of Object.entries(activity)) if (d >= cut) recent += a.tasksCompleted;
  const pace = recent / 21;
  const perDay = historyDays < 14 ? perDayPlan : Math.max(pace, perDayPlan * 0.4);
  const days = Math.ceil(remaining / perDay);
  return { date: addDays(today, days), weeks: Math.round(days / 7) };
}

// ───────────────────────────────────────────── daily activity & streak
export interface DayActivity {
  date: string; tasksCompleted: number; taskIds: string[]; plannedMinutes: number; studyMinutes: number;
  dsaAttempts: number; dsaSolved: number; revisionsCompleted: number; milestones: number; notes: number; units: number;
}
const blank = (date: string): DayActivity => ({
  date, tasksCompleted: 0, taskIds: [], plannedMinutes: 0, studyMinutes: 0, dsaAttempts: 0, dsaSolved: 0, revisionsCompleted: 0, milestones: 0, notes: 0, units: 0,
});

/**
 * Per-date activity derived from CURRENT state (un-completing a task removes it from its day, exactly like
 * the source's log decrement). Study units = roadmap tasks completed + DSA problems solved + project
 * milestones checked. Timer minutes and simply opening the app never count on their own.
 */
export function dailyActivity(s: UserState): Record<string, DayActivity> {
  const out: Record<string, DayActivity> = {};
  const at = (d: string) => (out[d] ??= blank(d));
  for (const [id, t] of Object.entries(s.tasks)) {
    if (t.status !== "completed" || !t.completedDate) continue;
    const a = at(t.completedDate);
    a.tasksCompleted++;
    a.taskIds.push(id);
    a.plannedMinutes += IDX.byId.get(id)?.minutes ?? 0;
  }
  for (const x of Object.values(s.sessions)) at(x.date).studyMinutes += x.minutes;
  for (const x of Object.values(s.dsaAttempts)) {
    const a = at(x.date);
    a.dsaAttempts++;
    if (x.outcome === "solved") a.dsaSolved++;
  }
  // revision completions are computed by the DSA engine; count solved non-first attempts after the problem's first solve
  const firstSolve = new Map<string, string>();
  for (const x of Object.values(s.dsaAttempts).sort((a, b) => (a.at < b.at ? -1 : 1))) {
    if (x.outcome !== "solved") continue;
    const f = firstSolve.get(x.problemId);
    if (!f) firstSolve.set(x.problemId, x.date);
    else if (x.date > f && x.mode !== "first") at(x.date).revisionsCompleted++;
  }
  for (const [key, c] of Object.entries(s.checks)) {
    if (!c.on) continue;
    if (c.scope === "lab-milestone" || (c.scope === "project" && /:m\d+$/.test(key))) at(c.date).milestones++;
  }
  for (const n of Object.values(s.notes)) if (n.text.trim()) at(n.date).notes++;
  for (const a of Object.values(out)) a.units = a.tasksCompleted + a.dsaSolved + a.milestones;
  return out;
}

export interface StreakInfo { current: number; longest: number; activeDays: number; activeDates: string[]; todayActive: boolean; unitsToday: number; threshold: number }
export function computeStreak(activeDates: Iterable<string>, today: string): { current: number; longest: number } {
  const set = new Set(activeDates);
  let current = 0;
  let d = set.has(today) ? today : addDays(today, -1); // today isn't lost until it ends (source behaviour)
  while (set.has(d)) { current++; d = addDays(d, -1); }
  const sorted = [...set].sort();
  let longest = 0, run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && diffDays(sorted[i - 1], sorted[i]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return { current, longest };
}
export function streakInfo(s: UserState, today: string): StreakInfo {
  const threshold = s.prefs.streakThreshold;
  const act = dailyActivity(s);
  const activeDates = Object.values(act).filter((a) => a.units >= threshold).map((a) => a.date).sort();
  const { current, longest } = computeStreak(activeDates, today);
  return { current, longest, activeDays: activeDates.length, activeDates, todayActive: activeDates.includes(today), unitsToday: act[today]?.units ?? 0, threshold };
}

/** Days since the last day with any recorded learning activity (for welcome-back + recovery rules). */
export function gapSinceLastActivity(s: UserState, today: string): number | null {
  const dates = Object.keys(dailyActivity(s)).filter((d) => d <= today).sort();
  if (!dates.length) return null;
  return diffDays(dates[dates.length - 1], today);
}

// ───────────────────────────────────────────── gates, mastery, checklists
export function gateStatus(s: UserState, phase: string): GateStatus {
  const explicit = s.gates[phase]?.status;
  if (explicit) return explicit;
  const g = IDX.gates.find((x) => x.phase === phase);
  if (!g) return "not_started";
  for (let i = 0; i < g.criteria; i++) if (s.checks[`as:${phase}:pc${i}`]?.on) return "in_progress";
  return "not_started";
}
export const gateCriteriaMet = (s: UserState, phase: string) => {
  const g = IDX.gates.find((x) => x.phase === phase);
  if (!g) return false;
  for (let i = 0; i < g.criteria; i++) if (!s.checks[`as:${phase}:pc${i}`]?.on) return false;
  return true;
};
export const gatePassed = (s: UserState, phase: string) => gateStatus(s, phase) === "passed";

export type MasteryStatus = "not_started" | "in_progress" | "ready_to_confirm" | "mastered" | "needs_revisit";
export function masteryItemsDone(s: UserState, id: string): number {
  const m = IDX.mastery.find((x) => x.id === id);
  if (!m) return 0;
  let n = 0;
  for (let i = 0; i < m.items; i++) if (s.checks[`ms:${id}:${i}`]?.on) n++;
  return n;
}
export function masteryStatus(s: UserState, id: string): MasteryStatus {
  const m = IDX.mastery.find((x) => x.id === id);
  if (!m) return "not_started";
  const done = masteryItemsDone(s, id);
  const confirmed = s.mastery[id]?.confirmed;
  if (confirmed) return done === m.items ? "mastered" : "needs_revisit";
  if (done === m.items) return "ready_to_confirm";
  return done ? "in_progress" : "not_started";
}

export function checklistProgress(s: UserState, keys: string[]): { done: number; total: number; pct: number } {
  const done = keys.filter((k) => s.checks[k]?.on).length;
  return { done, total: keys.length, pct: keys.length ? Math.round((100 * done) / keys.length) : 0 };
}
/** Source projProgress(): features + milestones + GitHub checklist of an existing project. */
export function existingProjectKeys(id: string): string[] {
  const p = IDX.existingProjects.find((x) => x.id === id);
  if (!p) return [];
  return [
    ...Array.from({ length: p.features }, (_, i) => `pj:${id}:f${i}`),
    ...Array.from({ length: p.milestones }, (_, i) => `pj:${id}:m${i}`),
    ...Array.from({ length: p.github }, (_, i) => `pj:${id}:g${i}`),
  ];
}
export function sideTrackKeys(trackId: string, moduleIdx?: number): string[] {
  const t = IDX.sideTracks.find((x) => x.id === trackId);
  if (!t) return [];
  const keys: string[] = [];
  t.checks.forEach((n, i) => {
    if (moduleIdx !== undefined && i !== moduleIdx) return;
    for (let j = 0; j < n; j++) keys.push(`st:${trackId}:${i}:${j}`);
  });
  return keys;
}
export function finalKeys(category: string): string[] {
  const f = IDX.finalReadiness.find((x) => x.category === category);
  return f ? Array.from({ length: f.items }, (_, i) => `fn:${category}:${i}`) : [];
}

export function totalStudyMinutes(s: UserState): number {
  return Object.values(s.sessions).reduce((a, x) => a + x.minutes, 0);
}

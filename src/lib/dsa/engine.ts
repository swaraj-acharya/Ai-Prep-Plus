import { addDays, diffDays } from "@/lib/dates";
import type { DsaAttempt, UserState } from "@/lib/state/reducer";

export interface RevisionStage { stage: number; intervalDays: number; dueDate: string; completedDate?: string }
export interface ProblemStatus {
  problemId: string;
  attempts: DsaAttempt[];
  attempted: boolean;
  solved: boolean;
  /** Solved on the first recorded attempt in first-pass mode. */
  firstPassSolved: boolean;
  /** Solved at least once cold (cold / revision / timed mode, after the first solve day or as a cold attempt). */
  coldSolved: boolean;
  firstSolvedDate?: string;
  lastAttempt?: DsaAttempt;
  bestMinutes?: number;
  mistakes: Record<string, number>;
  revisionsCompleted: number;
  /** Index into the interval list of the next revision; === intervals.length when fully retained. */
  stage: number;
  nextDue?: string;
  dueInDays?: number;
  retained: boolean;
  schedule: RevisionStage[];
}

const byTime = (a: DsaAttempt, b: DsaAttempt) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1);

/**
 * Spaced revision (Leitner-style) anchored on the first successful solve:
 *   due(0) = firstSolve + intervals[0]; each later SOLVED non-first attempt on/after the due date
 *   advances one stage (due(k) = thatDate + intervals[k]). An unsolved/partial revision resets to stage 0.
 * Solving the original problem never completes a revision by itself.
 */
export function problemStatus(problemId: string, attemptsAll: DsaAttempt[], intervals: number[], today: string): ProblemStatus {
  const attempts = attemptsAll.filter((a) => a.problemId === problemId).sort(byTime);
  const mistakes: Record<string, number> = {};
  for (const a of attempts) if (a.mistakeType) mistakes[a.mistakeType] = (mistakes[a.mistakeType] ?? 0) + 1;
  const solvedAttempts = attempts.filter((a) => a.outcome === "solved");
  const first = attempts[0];
  const firstSolve = solvedAttempts[0];
  const status: ProblemStatus = {
    problemId, attempts, attempted: attempts.length > 0, solved: solvedAttempts.length > 0,
    firstPassSolved: !!first && first.outcome === "solved" && first.mode === "first",
    coldSolved: solvedAttempts.some((a) => a.mode === "cold" || a.mode === "timed" || (a.mode === "revision" && firstSolve && a.date > firstSolve.date)),
    firstSolvedDate: firstSolve?.date, lastAttempt: attempts[attempts.length - 1],
    bestMinutes: solvedAttempts.length ? Math.min(...solvedAttempts.map((a) => a.minutes).filter((m) => m > 0).concat(Infinity)) : undefined,
    mistakes, revisionsCompleted: 0, stage: 0, retained: false, schedule: [],
  };
  if (status.bestMinutes === Infinity) status.bestMinutes = undefined;
  if (!firstSolve || !intervals.length) return status;

  let stage = 0;
  let due = addDays(firstSolve.date, intervals[0]);
  const schedule: RevisionStage[] = [];
  for (const a of attempts) {
    if (a === firstSolve || a.at <= firstSolve.at || a.mode === "first") continue;
    if (a.date <= firstSolve.date) continue; // same-day re-solves are not spaced repetition
    if (stage >= intervals.length) break;
    if (a.outcome === "solved") {
      if (a.date < due) continue; // too early — doesn't count as a spaced revision
      schedule.push({ stage, intervalDays: intervals[stage], dueDate: due, completedDate: a.date });
      status.revisionsCompleted++;
      stage++;
      if (stage < intervals.length) due = addDays(a.date, intervals[stage]);
    } else {
      stage = 0; // lapse → restart the ladder from tomorrow's interval
      due = addDays(a.date, intervals[0]);
    }
  }
  status.stage = stage;
  status.schedule = schedule;
  if (stage >= intervals.length) status.retained = true;
  else {
    status.nextDue = due;
    status.dueInDays = diffDays(today, due);
    schedule.push({ stage, intervalDays: intervals[stage], dueDate: due });
  }
  return status;
}

export function allProblemStatuses(s: UserState, problemIds: string[], today: string): Map<string, ProblemStatus> {
  const attempts = Object.values(s.dsaAttempts);
  const intervals = s.prefs.revisionIntervals?.length ? s.prefs.revisionIntervals : [1, 7, 21, 30];
  return new Map(problemIds.map((id) => [id, problemStatus(id, attempts, intervals, today)]));
}

export interface DsaSummary {
  attempted: number; solved: number; firstPassSolved: number; coldSolved: number; retained: number;
  revisionDue: number; revisionOverdue: number; revisionsCompleted: number; totalAttempts: number; mistakes: Record<string, number>;
}
export function dsaSummary(statuses: Iterable<ProblemStatus>): DsaSummary {
  const out: DsaSummary = { attempted: 0, solved: 0, firstPassSolved: 0, coldSolved: 0, retained: 0, revisionDue: 0, revisionOverdue: 0, revisionsCompleted: 0, totalAttempts: 0, mistakes: {} };
  for (const p of statuses) {
    if (p.attempted) out.attempted++;
    if (p.solved) out.solved++;
    if (p.firstPassSolved) out.firstPassSolved++;
    if (p.coldSolved) out.coldSolved++;
    if (p.retained) out.retained++;
    if (p.dueInDays !== undefined && p.dueInDays <= 0) out.revisionDue++;
    if (p.dueInDays !== undefined && p.dueInDays < 0) out.revisionOverdue++;
    out.revisionsCompleted += p.revisionsCompleted;
    out.totalAttempts += p.attempts.length;
    for (const [k, v] of Object.entries(p.mistakes)) out.mistakes[k] = (out.mistakes[k] ?? 0) + v;
  }
  return out;
}

/** Revision queue: due/overdue first (most overdue first), then upcoming within `horizonDays`. */
export function revisionQueue(statuses: Iterable<ProblemStatus>, horizonDays = 7): ProblemStatus[] {
  return [...statuses]
    .filter((p) => p.dueInDays !== undefined && p.dueInDays <= horizonDays)
    .sort((a, b) => (a.dueInDays! - b.dueInDays!) || a.problemId.localeCompare(b.problemId));
}

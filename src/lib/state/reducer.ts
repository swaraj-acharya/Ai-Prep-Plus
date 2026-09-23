import { DEFAULT_REVISION_INTERVALS, DEFAULT_STREAK_THRESHOLD } from "@/lib/roadmap/constants";
import {
  compareEvents, stampOf,
  type CheckScope, type DsaMode, type DsaOutcome, type EvidenceField, type GateStatus, type LearningEvent, type ProjectStatus, type TaskStatus,
} from "./events";

/**
 * Projection of the event log. Every keyed value is a last-writer-wins register stamped with
 * `${occurredAt}|${eventId}`, so applying events in ANY order converges to the same state.
 * Appended collections (attempts, sessions, syncs) are keyed by event id and therefore idempotent.
 */
export interface Stamped { v: string }
export interface TaskState extends Stamped { status: TaskStatus; completedAt?: string; completedDate?: string; startedDate?: string; reason?: string }
export interface CheckState extends Stamped { on: boolean; scope: CheckScope; date: string }
export interface NoteState extends Stamped { text: string; date: string }
export interface MasteryState extends Stamped { confirmed: boolean; date: string }
export interface GateState extends Stamped { status: GateStatus; date: string; history: { status: GateStatus; date: string; v: string }[] }
export interface ProjectState extends Stamped {
  status: ProjectStatus; date: string;
  history: { status: ProjectStatus; date: string; v: string }[];
  evidence: Partial<Record<EvidenceField, { value: string } & Stamped>>;
}
export interface DsaAttempt {
  id: string; problemId: string; at: string; date: string; mode: DsaMode; outcome: DsaOutcome; minutes: number;
  mistakeType?: string; notes?: string; taskId?: string;
}
export interface StudySession { id: string; startedAt: string; endedAt: string; minutes: number; date: string; taskId?: string; source: string }
export interface Prefs {
  timezone: string; streakThreshold: number; revisionIntervals: number[]; interests: string[];
  startDate: string; mustOnly: boolean; dailyTargetMinutes: number;
}
export interface SyncRecord { id: string; at: string; date: string; repo: string; commits: { sha: string; message: string }[]; filesChanged: number }

export interface UserState {
  tasks: Record<string, TaskState>;
  checks: Record<string, CheckState>;
  notes: Record<string, NoteState>;
  mastery: Record<string, MasteryState>;
  gates: Record<string, GateState>;
  projects: Record<string, ProjectState>;
  dsaAttempts: Record<string, DsaAttempt>;
  sessions: Record<string, StudySession>;
  prefs: Prefs;
  prefStamps: Partial<Record<keyof Prefs, string>>;
  syncs: Record<string, SyncRecord>;
  imports: { id: string; date: string; summary: Record<string, number> }[];
  eventIds: Set<string>;
  lastEventAt?: string;
  firstEventDate?: string;
}

export const DEFAULT_PREFS: Prefs = {
  timezone: "UTC",
  streakThreshold: DEFAULT_STREAK_THRESHOLD,
  revisionIntervals: DEFAULT_REVISION_INTERVALS,
  interests: [],
  startDate: "",
  mustOnly: false,
  dailyTargetMinutes: 300,
};

export function emptyState(): UserState {
  return {
    tasks: {}, checks: {}, notes: {}, mastery: {}, gates: {}, projects: {}, dsaAttempts: {}, sessions: {},
    prefs: { ...DEFAULT_PREFS }, prefStamps: {}, syncs: {}, imports: [], eventIds: new Set(),
  };
}

const newer = (current: Stamped | undefined, v: string) => !current || v > current.v;

function setTask(s: UserState, e: LearningEvent, taskId: string, status: TaskStatus, extra: Partial<TaskState> = {}) {
  const v = stampOf(e);
  const cur = s.tasks[taskId];
  if (!newer(cur, v)) return;
  const next: TaskState = { status, v, ...extra };
  if (status === "in_progress") next.startedDate = e.localDate;
  if (status === "completed") {
    next.completedAt = e.occurredAt;
    next.completedDate = e.localDate;
  }
  s.tasks[taskId] = next;
}

function setGate(s: UserState, e: LearningEvent, phase: string, status: GateStatus) {
  const v = stampOf(e);
  const cur = s.gates[phase];
  const history = [...(cur?.history ?? []), { status, date: e.localDate, v }].sort((a, b) => (a.v < b.v ? -1 : 1));
  if (newer(cur, v)) s.gates[phase] = { status, date: e.localDate, v, history };
  else s.gates[phase] = { ...cur!, history };
}

export function applyEvent(s: UserState, e: LearningEvent): UserState {
  if (s.eventIds.has(e.id)) return s;
  s.eventIds.add(e.id);
  if (!s.lastEventAt || e.occurredAt > s.lastEventAt) s.lastEventAt = e.occurredAt;
  if (!s.firstEventDate || e.localDate < s.firstEventDate) s.firstEventDate = e.localDate;
  const v = stampOf(e);

  switch (e.type) {
    case "TASK_STARTED": setTask(s, e, e.payload.taskId, "in_progress"); break;
    case "TASK_COMPLETED": setTask(s, e, e.payload.taskId, "completed"); break;
    case "TASK_UNCOMPLETED": setTask(s, e, e.payload.taskId, "not_started"); break;
    case "TASK_SKIPPED": setTask(s, e, e.payload.taskId, "skipped", { reason: e.payload.reason }); break;
    case "TASK_DEFERRED": setTask(s, e, e.payload.taskId, "deferred", { reason: e.payload.reason }); break;
    case "CHECK_SET": {
      const cur = s.checks[e.payload.key];
      if (newer(cur, v)) s.checks[e.payload.key] = { on: e.payload.on, scope: e.payload.scope, date: e.localDate, v };
      break;
    }
    case "MASTERY_CONFIRMED":
    case "MASTERY_REVOKED": {
      const cur = s.mastery[e.payload.masteryId];
      if (newer(cur, v)) s.mastery[e.payload.masteryId] = { confirmed: e.type === "MASTERY_CONFIRMED", date: e.localDate, v };
      break;
    }
    case "ASSESSMENT_STARTED": setGate(s, e, e.payload.phase, "in_progress"); break;
    case "ASSESSMENT_PASSED": setGate(s, e, e.payload.phase, "passed"); break;
    case "ASSESSMENT_NEEDS_REVISIT": setGate(s, e, e.payload.phase, "needs_revisit"); break;
    case "ASSESSMENT_RESET": setGate(s, e, e.payload.phase, "not_started"); break;
    case "DSA_ATTEMPTED":
      s.dsaAttempts[e.id] = {
        id: e.id, problemId: e.payload.problemId, at: e.occurredAt, date: e.localDate, mode: e.payload.mode, outcome: e.payload.outcome,
        minutes: e.payload.minutes, mistakeType: e.payload.mistakeType, notes: e.payload.notes, taskId: e.payload.taskId,
      };
      break;
    case "PROJECT_STATUS_SET": {
      const { projectId, status } = e.payload;
      const cur = s.projects[projectId];
      const history = [...(cur?.history ?? []), { status, date: e.localDate, v }].sort((a, b) => (a.v < b.v ? -1 : 1));
      const base: ProjectState = cur ?? { status: "idea", date: e.localDate, v: "", history: [], evidence: {} };
      s.projects[projectId] = newer(cur, v) ? { ...base, status, date: e.localDate, v, history } : { ...base, history };
      break;
    }
    case "PROJECT_EVIDENCE_SET": {
      const { projectId, field, value } = e.payload;
      const cur = s.projects[projectId] ?? { status: "idea" as ProjectStatus, date: e.localDate, v: "", history: [], evidence: {} };
      const ev = cur.evidence[field];
      if (newer(ev, v)) cur.evidence = { ...cur.evidence, [field]: { value, v } };
      s.projects[projectId] = cur;
      break;
    }
    case "NOTE_SAVED": {
      const cur = s.notes[e.payload.key];
      if (newer(cur, v)) s.notes[e.payload.key] = { text: e.payload.text, date: e.localDate, v };
      break;
    }
    case "STUDY_SESSION_COMPLETED":
      s.sessions[e.id] = {
        id: e.id, startedAt: e.payload.startedAt, endedAt: e.payload.endedAt, minutes: e.payload.minutes, date: e.localDate,
        taskId: e.payload.taskId, source: e.payload.source,
      };
      break;
    case "PREFERENCES_UPDATED": {
      const patch = e.payload.patch;
      for (const k of Object.keys(patch) as (keyof Prefs)[]) {
        const cur = s.prefStamps[k];
        if (!cur || v > cur) {
          (s.prefs as unknown as Record<string, unknown>)[k] = patch[k as keyof typeof patch];
          s.prefStamps[k] = v;
        }
      }
      break;
    }
    case "GITHUB_SYNCED":
      s.syncs[e.id] = { id: e.id, at: e.occurredAt, date: e.localDate, ...e.payload };
      break;
    case "LEGACY_IMPORTED":
      s.imports.push({ id: e.id, date: e.localDate, summary: e.payload.summary });
      break;
  }
  return s;
}

/** Deterministic full replay. */
export function reduceEvents(events: readonly LearningEvent[], base: UserState = emptyState()): UserState {
  const sorted = [...events].sort(compareEvents);
  for (const e of sorted) applyEvent(base, e);
  return base;
}

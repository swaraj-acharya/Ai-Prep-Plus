import { z } from "zod";

/**
 * Every user action that changes learning state is an immutable event.
 * - `id` is generated on the device (UUID) → pushing the same event twice is a no-op (idempotent).
 * - `occurredAt` (UTC ISO) + `id` give a total order → replaying events in any arrival order yields the same state.
 * - `localDate` is the calendar date in the user's timezone at the moment of the action → streaks are timezone-aware.
 * - `roadmapVersion` ties progress to the canonical roadmap it was recorded against.
 */
const isoInstant = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/, "UTC ISO timestamp expected");
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD expected");
/** Source ids: w{week}d{day}t{n} and, for the 21 cloud tasks, w{week}d{day}cloud. */
export const TASK_ID_RE = /^w\d{1,2}d\d+(t\d+|cloud)$/;
const taskId = z.string().regex(TASK_ID_RE, "roadmap task id expected");
const shortText = z.string().max(200);
const longText = z.string().max(20_000);

export const TASK_STATUSES = ["not_started", "in_progress", "completed", "skipped", "deferred"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const GATE_STATUSES = ["not_started", "in_progress", "passed", "needs_revisit"] as const;
export type GateStatus = (typeof GATE_STATUSES)[number];
export const PROJECT_STATUSES = ["idea", "planned", "ready", "in_progress", "paused", "completed", "shipped", "portfolio_ready"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const CHECK_SCOPES = ["mastery", "gate", "project", "side", "final", "lab-milestone", "lab-quality"] as const;
export type CheckScope = (typeof CHECK_SCOPES)[number];
export const DSA_MODES = ["first", "cold", "revision", "timed"] as const;
export type DsaMode = (typeof DSA_MODES)[number];
export const DSA_OUTCOMES = ["solved", "partial", "unsolved"] as const;
export type DsaOutcome = (typeof DSA_OUTCOMES)[number];
export const EVIDENCE_FIELDS = ["repo", "demo", "architecture", "screenshots", "video", "benchmark", "coverage", "article", "postmortem"] as const;
export type EvidenceField = (typeof EVIDENCE_FIELDS)[number];

export const PrefsPatch = z
  .object({
    timezone: z.string().max(64),
    streakThreshold: z.number().int().min(1).max(20),
    revisionIntervals: z.array(z.number().int().min(1).max(365)).min(1).max(8),
    interests: z.array(z.string().max(40)).max(30),
    startDate: localDate.or(z.literal("")),
    mustOnly: z.boolean(),
    dailyTargetMinutes: z.number().int().min(15).max(900),
  })
  .partial();
export type PrefsPatch = z.infer<typeof PrefsPatch>;

const envelope = {
  id: z.string().uuid(),
  occurredAt: isoInstant,
  localDate,
  tz: z.string().max(64),
  roadmapVersion: z.string().max(64),
  deviceId: z.string().max(64).optional(),
};

const ev = <T extends string, P extends z.ZodTypeAny>(type: T, payload: P) =>
  z.object({ ...envelope, type: z.literal(type), payload });

export const LearningEvent = z.discriminatedUnion("type", [
  ev("TASK_STARTED", z.object({ taskId })),
  ev("TASK_COMPLETED", z.object({ taskId })),
  ev("TASK_UNCOMPLETED", z.object({ taskId })),
  ev("TASK_SKIPPED", z.object({ taskId, reason: shortText.optional() })),
  ev("TASK_DEFERRED", z.object({ taskId, reason: shortText.optional() })),
  ev("CHECK_SET", z.object({ scope: z.enum(CHECK_SCOPES), key: z.string().min(3).max(160), on: z.boolean() })),
  ev("MASTERY_CONFIRMED", z.object({ masteryId: z.string().max(40) })),
  ev("MASTERY_REVOKED", z.object({ masteryId: z.string().max(40) })),
  ev("ASSESSMENT_STARTED", z.object({ phase: z.string().max(4) })),
  ev("ASSESSMENT_PASSED", z.object({ phase: z.string().max(4) })),
  ev("ASSESSMENT_NEEDS_REVISIT", z.object({ phase: z.string().max(4) })),
  ev("ASSESSMENT_RESET", z.object({ phase: z.string().max(4) })),
  ev(
    "DSA_ATTEMPTED",
    z.object({
      problemId: z.string().max(80),
      mode: z.enum(DSA_MODES),
      outcome: z.enum(DSA_OUTCOMES),
      minutes: z.number().int().min(0).max(600),
      mistakeType: z.enum(["concept", "pattern", "implementation", "complexity", "communication"]).optional(),
      notes: z.string().max(4000).optional(),
      taskId: taskId.optional(),
    }),
  ),
  ev("PROJECT_STATUS_SET", z.object({ projectId: z.string().max(80), status: z.enum(PROJECT_STATUSES) })),
  ev("PROJECT_EVIDENCE_SET", z.object({ projectId: z.string().max(80), field: z.enum(EVIDENCE_FIELDS), value: z.string().max(2000) })),
  ev("NOTE_SAVED", z.object({ key: z.string().min(1).max(120), text: longText })),
  ev(
    "STUDY_SESSION_COMPLETED",
    z.object({
      startedAt: isoInstant,
      endedAt: isoInstant,
      minutes: z.number().int().min(1).max(24 * 60),
      taskId: taskId.optional(),
      source: z.enum(["timer", "manual", "imported"]),
    }),
  ),
  ev("PREFERENCES_UPDATED", z.object({ patch: PrefsPatch })),
  ev(
    "GITHUB_SYNCED",
    z.object({ repo: z.string().max(200), commits: z.array(z.object({ sha: z.string().max(64), message: z.string().max(500) })).max(20), filesChanged: z.number().int().min(0) }),
  ),
  ev("LEGACY_IMPORTED", z.object({ summary: z.record(z.string(), z.number()) })),
]);
export type LearningEvent = z.infer<typeof LearningEvent>;
export type EventType = LearningEvent["type"];
export type EventOf<T extends EventType> = Extract<LearningEvent, { type: T }>;
export type EventPayload<T extends EventType> = EventOf<T>["payload"];

/** Events that clients may submit. GITHUB_SYNCED is written only by the server. */
export const CLIENT_EVENT_TYPES = new Set<EventType>(
  LearningEvent.options.map((o) => o.shape.type.value).filter((t) => t !== "GITHUB_SYNCED"),
);

export const EventBatch = z.object({ events: z.array(LearningEvent).max(500) });

/** Deterministic total order used by every replay. */
export function compareEvents(a: Pick<LearningEvent, "occurredAt" | "id">, b: Pick<LearningEvent, "occurredAt" | "id">): number {
  if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
export const stampOf = (e: Pick<LearningEvent, "occurredAt" | "id">) => `${e.occurredAt}|${e.id}`;

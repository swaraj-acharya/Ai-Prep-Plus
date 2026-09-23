import { IDX } from "@/lib/roadmap/client-index";
import { ROADMAP_VERSION } from "@/lib/roadmap/constants";
import { isDateString, localDateOf } from "@/lib/dates";
import { LearningEvent, TASK_ID_RE, type CheckScope } from "./events";
import { uuid } from "./factory";

/**
 * Importers for (a) backups of the original single-file app (localStorage key `learning-os-v1`) and
 * (b) AI PrepBoard's own event backups. Both produce ordinary events, so importing twice is harmless
 * for (b) (same ids) and bounded for (a) (later LWW writes win; nothing is double-counted).
 */
export const BACKUP_FORMAT = "ai-prepboard-backup";

export interface ImportReport {
  kind: "legacy" | "backup";
  events: LearningEvent[];
  summary: Record<string, number>;
  dropped: { key: string; reason: string }[];
}

const SCOPE_BY_PREFIX: Record<string, CheckScope> = { ms: "mastery", as: "gate", pj: "project", st: "side", fn: "final" };

function instantFor(date: string | undefined, fallback: string): { occurredAt: string; localDate: string } {
  if (date && isDateString(date)) return { occurredAt: `${date}T12:00:00.000Z`, localDate: date };
  if (date && !Number.isNaN(Date.parse(date))) {
    const d = new Date(date);
    return { occurredAt: d.toISOString(), localDate: localDateOf(d, "UTC") };
  }
  return { occurredAt: fallback, localDate: fallback.slice(0, 10) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Legacy = { done?: Record<string, boolean>; doneAt?: Record<string, string>; notes?: Record<string, any>; checks?: Record<string, boolean>; prefs?: Record<string, any>; timer?: { byDate?: Record<string, number> } };

export function importLegacy(input: unknown, tz: string, now = new Date()): ImportReport {
  const src = (input ?? {}) as Legacy;
  if (typeof src !== "object" || (!src.done && !src.checks && !src.notes)) throw new Error("This file does not look like a Learning OS backup (expected done/checks/notes).");
  const nowIso = now.toISOString();
  const events: LearningEvent[] = [];
  const dropped: ImportReport["dropped"] = [];
  const summary: Record<string, number> = { tasks: 0, checks: 0, gatesPassed: 0, notes: 0, studyDays: 0, vlsiChecksRemoved: 0 };
  const push = (type: string, payload: unknown, when: { occurredAt: string; localDate: string }) => {
    const e = LearningEvent.safeParse({ id: uuid(), type, payload, ...when, tz, roadmapVersion: ROADMAP_VERSION });
    if (e.success) events.push(e.data);
    else dropped.push({ key: `${type}:${JSON.stringify(payload).slice(0, 60)}`, reason: e.error.issues[0]?.message ?? "invalid" });
  };

  for (const [id, on] of Object.entries(src.done ?? {})) {
    if (!on) continue;
    if (!TASK_ID_RE.test(id) || !IDX.byId.has(id)) { dropped.push({ key: id, reason: "unknown task" }); continue; }
    push("TASK_COMPLETED", { taskId: id }, instantFor(src.doneAt?.[id], nowIso));
    summary.tasks++;
  }
  const phasesWithChecks = new Set<string>();
  for (const [key, on] of Object.entries(src.checks ?? {})) {
    if (!on) continue;
    const prefix = key.split(":")[0];
    if (prefix === "vl") { summary.vlsiChecksRemoved++; continue; }
    const scope = SCOPE_BY_PREFIX[prefix];
    if (!scope) { dropped.push({ key, reason: "unknown checklist" }); continue; }
    push("CHECK_SET", { scope, key, on: true }, instantFor(undefined, nowIso));
    summary.checks++;
    if (prefix === "as") phasesWithChecks.add(key.split(":")[1]);
  }
  for (const phase of phasesWithChecks) {
    const g = IDX.gates.find((x) => x.phase === phase);
    if (!g) continue;
    const all = Array.from({ length: g.criteria }, (_, i) => src.checks?.[`as:${phase}:pc${i}`]).every(Boolean);
    if (all) { push("ASSESSMENT_PASSED", { phase }, instantFor(undefined, nowIso)); summary.gatesPassed++; }
  }
  for (const [key, val] of Object.entries(src.notes ?? {})) {
    if (val && typeof val === "object") {
      for (const [f, text] of Object.entries(val as Record<string, string>)) {
        if (typeof text !== "string" || !text.trim()) continue;
        push("NOTE_SAVED", { key: `review:W${key}:${f}`.slice(0, 120), text: text.slice(0, 20000) }, instantFor(undefined, nowIso));
        summary.notes++;
      }
    } else if (typeof val === "string" && val.trim()) {
      push("NOTE_SAVED", { key: key.slice(0, 120), text: val.slice(0, 20000) }, instantFor(undefined, nowIso));
      summary.notes++;
    }
  }
  for (const [date, minutes] of Object.entries(src.timer?.byDate ?? {})) {
    const m = Math.round(Number(minutes));
    if (!isDateString(date) || !(m > 0)) continue;
    const when = instantFor(date, nowIso);
    push("STUDY_SESSION_COMPLETED", { startedAt: when.occurredAt, endedAt: when.occurredAt, minutes: Math.min(m, 1440), source: "imported" }, when);
    summary.studyDays++;
  }
  const prefs: Record<string, unknown> = {};
  if (isDateString(src.prefs?.start)) prefs.startDate = src.prefs!.start;
  if (typeof src.prefs?.mustOnly === "boolean") prefs.mustOnly = src.prefs.mustOnly;
  if (Object.keys(prefs).length) push("PREFERENCES_UPDATED", { patch: prefs }, instantFor(undefined, nowIso));
  push("LEGACY_IMPORTED", { summary }, instantFor(undefined, nowIso));
  return { kind: "legacy", events, summary, dropped };
}

export function exportBackup(events: readonly LearningEvent[], now = new Date()) {
  return { format: BACKUP_FORMAT, formatVersion: 1, roadmapVersion: ROADMAP_VERSION, exportedAt: now.toISOString(), count: events.length, events };
}

export function importBackup(input: unknown): ImportReport {
  const b = input as { format?: string; events?: unknown[] };
  if (b?.format !== BACKUP_FORMAT || !Array.isArray(b.events)) throw new Error("Not an AI PrepBoard backup file.");
  const events: LearningEvent[] = [];
  const dropped: ImportReport["dropped"] = [];
  for (const raw of b.events) {
    const e = LearningEvent.safeParse(raw);
    if (e.success && e.data.type !== "GITHUB_SYNCED") events.push(e.data);
    else dropped.push({ key: String((raw as { id?: string })?.id ?? "?"), reason: e.success ? "server-only event" : e.error.issues[0]?.message ?? "invalid" });
  }
  return { kind: "backup", events, summary: { events: events.length }, dropped };
}

/** Auto-detect the file type. */
export function importAny(input: unknown, tz: string): ImportReport {
  if ((input as { format?: string })?.format === BACKUP_FORMAT) return importBackup(input);
  return importLegacy(input, tz);
}

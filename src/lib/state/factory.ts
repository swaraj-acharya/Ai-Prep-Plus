import { ROADMAP_VERSION } from "@/lib/roadmap/constants";
import { localDateOf } from "@/lib/dates";
import { LearningEvent, type EventPayload, type EventType } from "./events";

export function uuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** ISO instant with millisecond precision, always `Z`. */
export const isoNow = (d: Date = new Date()) => d.toISOString();

export interface EventContext { tz: string; now?: Date; deviceId?: string; roadmapVersion?: string }

/** Build a validated event. Throws if the payload is invalid (never persists garbage). */
export function makeEvent<T extends EventType>(type: T, payload: EventPayload<T>, ctx: EventContext): Extract<LearningEvent, { type: T }> {
  const now = ctx.now ?? new Date();
  const raw = {
    id: uuid(),
    type,
    occurredAt: isoNow(now),
    localDate: localDateOf(now, ctx.tz),
    tz: ctx.tz,
    roadmapVersion: ctx.roadmapVersion ?? ROADMAP_VERSION,
    ...(ctx.deviceId ? { deviceId: ctx.deviceId } : {}),
    payload,
  };
  return LearningEvent.parse(raw) as Extract<LearningEvent, { type: T }>;
}

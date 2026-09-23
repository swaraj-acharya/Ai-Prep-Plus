/**
 * Calendar-date helpers. All "dates" are YYYY-MM-DD strings in the user's timezone;
 * arithmetic is done on UTC midnights so DST never shifts a day.
 */
const fmtCache = new Map<string, Intl.DateTimeFormat>();

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function localDateOf(instant: Date | string | number, timeZone: string): string {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    fmtCache.set(tz, f);
  }
  const d = instant instanceof Date ? instant : new Date(instant);
  const parts = f.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const toUtc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(date: string, n: number): string {
  return fromUtc(toUtc(date) + n * 86_400_000);
}
/** b − a in whole days. */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}
export function isDateString(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtc(s));
}
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
/** ISO week-start (Monday) for a date string. */
export function weekStart(date: string): string {
  const dow = new Date(toUtc(date)).getUTCDay(); // 0 Sun
  return addDays(date, -((dow + 6) % 7));
}
export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  return new Date(toUtc(date)).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
}
export const nowIso = () => new Date().toISOString();

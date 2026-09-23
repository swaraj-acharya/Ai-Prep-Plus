import { CURATED, LINK_FIXES, type CuratedResource } from "@/data/resources/curated";
import type { Resource } from "@/lib/roadmap/types";

/**
 * Parses the source library's "weeks" labels into week numbers:
 *   "W21–W22" · "W7, W44" · "W19+" (→ to W52) · "W2–W3 + Side track/recall" · "Side track" (→ none)
 */
export function parseWeeks(label: string): number[] {
  const out = new Set<number>();
  const re = /W(\d{1,2})(?:\s*[–-]\s*W(\d{1,2})|(\+))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(label))) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : m[3] ? 52 : a;
    for (let w = Math.max(1, a); w <= Math.min(52, b); w++) out.add(w);
  }
  return [...out].sort((x, y) => x - y);
}

/** "W19–W24" style label for a list of weeks. */
export function formatWeeks(weeks: number[]): string {
  if (!weeks.length) return "";
  const s = [...weeks].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = s[0];
  let prev = s[0];
  for (const w of [...s.slice(1), Infinity]) {
    if (w === prev + 1) {
      prev = w;
      continue;
    }
    parts.push(start === prev ? `W${start}` : `W${start}–W${prev}`);
    start = prev = w;
  }
  return parts.join(", ");
}

/** The source library with links added for the book resources that had none. */
export function withLinkFixes(lib: Record<string, Resource>): Record<string, Resource & { linkNote?: string }> {
  const out: Record<string, Resource & { linkNote?: string }> = {};
  for (const [k, r] of Object.entries(lib)) out[k] = !r.url && LINK_FIXES[k] ? { ...r, url: LINK_FIXES[k].url, linkNote: LINK_FIXES[k].note } : r;
  return out;
}

export interface WeekResources {
  /** Resources the week plan names explicitly (source order). */
  scheduled: string[];
  /** Other source-library resources whose own week range covers this week. */
  library: string[];
  /** Curated additions for this week. */
  curated: CuratedResource[];
}
export function resourcesForWeek(week: number, scheduled: string[], lib: Record<string, Resource>): WeekResources {
  const sched = new Set(scheduled);
  const library = Object.entries(lib)
    .filter(([k, r]) => !sched.has(k) && parseWeeks(r.weeks).includes(week) && parseWeeks(r.weeks).length < 40)
    .map(([k]) => k);
  return { scheduled, library, curated: CURATED.filter((c) => c.weeks.includes(week)) };
}

/** Curated references for a Project Lab project: overlap on categories first, then on roadmap weeks. */
export function curatedForProject(categories: readonly string[], weeks: number[], limit = 6): CuratedResource[] {
  const scored = CURATED.map((c) => ({
    c,
    score: (c.categories ?? []).filter((x) => categories.includes(x)).length * 3 + c.weeks.filter((w) => weeks.includes(w)).length,
  })).filter((x) => x.score >= 3);
  return scored.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name)).slice(0, limit).map((x) => x.c);
}

export { CURATED, LINK_FIXES };
export type { CuratedResource };

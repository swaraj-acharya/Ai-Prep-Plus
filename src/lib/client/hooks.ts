"use client";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { loadWeekChunk } from "@/data/generated/weeks";
import type { Task, WeekChunk } from "@/lib/roadmap/types";
import type { UserState } from "@/lib/state/reducer";
import { useLearning } from "./store";

/** State + a revision counter; derive with useDerived so work reruns only when events change. */
export function useLS() {
  return useLearning(useShallow((s) => ({ state: s.state, rev: s.rev, hydrated: s.hydrated, dispatch: s.dispatch, today: s.today, tz: s.tz })));
}
export function useDerived<T>(fn: (s: UserState, today: string) => T, deps: unknown[] = []): T {
  const { state, rev, today } = useLS();
  const t = today();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => fn(state, t), [rev, t, ...deps]);
}

const weekCache = new Map<number, WeekChunk>();
const weekPending = new Map<number, Promise<WeekChunk>>();
export function fetchWeek(n: number): Promise<WeekChunk> {
  const hit = weekCache.get(n);
  if (hit) return Promise.resolve(hit);
  let p = weekPending.get(n);
  if (!p) {
    p = loadWeekChunk(n).then((w) => {
      weekCache.set(n, w);
      return w;
    });
    weekPending.set(n, p);
  }
  return p;
}
export function useWeek(n: number | null | undefined): WeekChunk | null {
  const [w, setW] = useState<WeekChunk | null>(n ? weekCache.get(n) ?? null : null);
  useEffect(() => {
    if (!n || n < 1 || n > 52) return;
    let live = true;
    fetchWeek(n).then((x) => live && setW(x)).catch(() => {});
    return () => {
      live = false;
    };
  }, [n]);
  return n && w?.n === n ? w : null;
}
/** Full task records (text, resource…) for arbitrary ids, loading only the weeks needed. */
export function useTasks(ids: string[]): Map<string, Task> {
  const key = ids.join(",");
  const [map, setMap] = useState<Map<string, Task>>(new Map());
  useEffect(() => {
    let live = true;
    const weeks = [...new Set(ids.map((id) => Number(/^w(\d+)/.exec(id)?.[1])).filter(Boolean))];
    Promise.all(weeks.map(fetchWeek)).then((ws) => {
      if (!live) return;
      const m = new Map<string, Task>();
      for (const w of ws) for (const t of w.tasks) if (ids.includes(t.id)) m.set(t.id, t);
      setMap(m);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

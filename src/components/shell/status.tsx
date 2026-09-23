"use client";
import { Flame, Moon, Square, Sun, Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui";
import { useLearning } from "@/lib/client/store";
import { useDerived, useLS, useNow } from "@/lib/client/hooks";
import { streakInfo } from "@/lib/state/selectors";

export function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

export function TimerChip() {
  const timer = useLearning((s) => s.timer);
  const stop = useLearning((s) => s.stopTimer);
  const now = useNow(1000);
  if (!timer) return null;
  return (
    <button onClick={() => stop()} title="Stop the study timer and log the session" className="flex h-8 items-center gap-1.5 rounded-md border border-accent/40 bg-accent-soft px-2 font-mono text-xs text-accent">
      <Timer className="size-3.5" />
      {fmtElapsed(now - Date.parse(timer.startedAt))}
      <Square className="size-3" />
    </button>
  );
}

/** "12 day streak" in the top bar, with today's progress toward the daily goal. */
export function StreakChip() {
  const { hydrated } = useLS();
  const st = useDerived((s, today) => streakInfo(s, today));
  if (!hydrated) return null;
  return (
    <Link
      href="/today"
      title={`Days in a row where you reached your daily goal (${st.threshold} study units). Today: ${st.unitsToday}/${st.threshold}.`}
      className={cx("flex h-8 items-center gap-1.5 rounded-md px-2 text-xs", st.todayActive ? "text-accent" : "text-muted hover:text-ink")}
    >
      <Flame className="size-3.5" />
      <span className="font-mono">{st.current}</span>
      <span className="hidden sm:inline">day{st.current === 1 ? "" : "s"} streak</span>
      <span className="hidden font-mono text-faint md:inline">
        · {st.unitsToday}/{st.threshold}
      </span>
    </Link>
  );
}

export function useTheme(): ["dark" | "light" | "system", (t: "dark" | "light" | "system") => void] {
  const [t, setT] = useState<"dark" | "light" | "system">("dark");
  useEffect(() => {
    try {
      setT(JSON.parse(localStorage.getItem("pb_theme") ?? '"dark"'));
    } catch {}
  }, []);
  const apply = (v: "dark" | "light" | "system") => {
    setT(v);
    localStorage.setItem("pb_theme", JSON.stringify(v));
    document.documentElement.dataset.theme = v === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : v;
  };
  return [t, apply];
}

export function ThemeToggle() {
  const [t, setT] = useTheme();
  const isLight = t === "light";
  return (
    <button onClick={() => setT(isLight ? "dark" : "light")} className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink" aria-label={`Switch to ${isLight ? "dark" : "light"} theme`}>
      {isLight ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}

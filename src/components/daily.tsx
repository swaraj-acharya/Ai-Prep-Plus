"use client";
import { Flame, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useDerived, useLS } from "@/lib/client/hooks";
import { addDays, dateRange, formatDate } from "@/lib/dates";
import { dailyActivity, estimatedCompletion, overallProgress, streakInfo } from "@/lib/state/selectors";
import { Card, cx, Progress } from "./ui";

/**
 * Daily track (reference-PrepBoard style): a daily goal, what you did today, your streak, an 18-week heatmap
 * and when you'll finish at your current pace. A day counts toward the streak when you reach the daily goal.
 */
export function DailyGoalCard() {
  const { dispatch } = useLS();
  const d = useDerived((s, today) => ({ st: streakInfo(s, today), a: dailyActivity(s)[today] }));
  const goal = d.st.threshold;
  const units = d.st.unitsToday;
  const setGoal = (g: number) => dispatch("PREFERENCES_UPDATED", { patch: { streakThreshold: Math.max(1, Math.min(20, g)) } });
  return (
    <Card title="Daily goal" action={<Link href="/history" className="text-xs text-muted hover:text-ink">History →</Link>}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-3xl tabular-nums">
            {units}
            <span className="text-lg text-faint">/{goal}</span>
          </div>
          <div className="text-xs text-muted">study units today</div>
        </div>
        <div className="shrink-0 text-right">
          <div className={cx("flex items-center justify-end gap-1 font-mono text-2xl tabular-nums", d.st.todayActive ? "text-accent" : "text-muted")}>
            <Flame className="size-5" />
            {d.st.current}
          </div>
          <div className="whitespace-nowrap text-xs text-muted">day streak · best {d.st.longest}</div>
        </div>
      </div>
      <p className={cx("mt-2 text-xs", units >= goal ? "text-good" : "text-muted")}>
        {units >= goal ? "Goal reached today — streak safe." : `${goal - units} more unit${goal - units === 1 ? "" : "s"} to keep your streak.`}
      </p>
      <Progress value={(100 * units) / goal} className="mt-3" tone={units >= goal ? "good" : "accent"} label="Progress toward today's goal" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          {d.a?.tasksCompleted ?? 0} tasks · {d.a?.dsaSolved ?? 0} DSA solved · {d.a?.milestones ?? 0} milestones · {d.a?.studyMinutes ?? 0} min
        </span>
        <span className="flex items-center gap-1">
          Goal
          <button className="grid size-6 place-items-center rounded border border-line hover:border-line-strong" aria-label="Lower daily goal" onClick={() => setGoal(goal - 1)}>
            <Minus className="size-3" />
          </button>
          <span className="w-5 text-center font-mono text-ink">{goal}</span>
          <button className="grid size-6 place-items-center rounded border border-line hover:border-line-strong" aria-label="Raise daily goal" onClick={() => setGoal(goal + 1)}>
            <Plus className="size-3" />
          </button>
        </span>
      </div>
    </Card>
  );
}

/** 18 weeks × 7 days, oldest top-left. Darker = more study units; ringed = daily goal met. */
export function Heatmap({ weeks = 18 }: { weeks?: number }) {
  const d = useDerived((s, today) => {
    const act = dailyActivity(s);
    const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
    const start = addDays(today, -(weeks - 1) * 7 - dow);
    return { today, days: dateRange(start, addDays(start, weeks * 7 - 1)).map((day) => ({ day, units: act[day]?.units ?? 0 })), goal: s.prefs.streakThreshold };
  }, [weeks]);
  const level = (u: number) => (u === 0 ? 0 : u < d.goal ? 0.3 : u < d.goal * 2 ? 0.65 : 1);
  return (
    <div>
      <div className="overflow-x-auto scroll-thin">
        <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label={`Study activity for the last ${weeks} weeks`}>
          {d.days.map(({ day, units }) => {
            const future = day > d.today;
            return (
              <Link
                key={day}
                href={future ? "#" : `/history#d-${day}`}
                title={future ? "" : `${formatDate(day)} — ${units} unit${units === 1 ? "" : "s"}${units >= d.goal ? " · goal met" : ""}`}
                aria-hidden={future}
                tabIndex={future ? -1 : undefined}
                className={cx("size-[12px] rounded-[2px]", future && "pointer-events-none opacity-0", day === d.today && "ring-1 ring-accent ring-offset-1 ring-offset-surface")}
                style={{ background: level(units) ? `color-mix(in srgb, var(--good) ${Math.round(level(units) * 100)}%, var(--cell-0))` : "var(--cell-0)" }}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-faint">
        Less
        {[0, 0.3, 0.65, 1].map((l) => (
          <span key={l} className="size-[10px] rounded-[2px]" style={{ background: l ? `color-mix(in srgb, var(--good) ${l * 100}%, var(--cell-0))` : "var(--cell-0)" }} />
        ))}
        More · full colour = goal met twice over
      </div>
    </div>
  );
}

/** Remaining work and the date you'll finish at your recent pace. */
export function FinishCard() {
  const d = useDerived((s, today) => ({ o: overallProgress(s), est: estimatedCompletion(s, today), start: s.prefs.startDate }));
  return (
    <Card title="Finish line">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xl">{d.o.pct}%</span>
        <span className="text-xs text-muted">
          {d.o.done.toLocaleString()} of {d.o.total.toLocaleString()} tasks
        </span>
      </div>
      <Progress value={d.o.pct} className="mt-2" />
      <p className="mt-2 text-xs text-muted">
        {d.est.date ? (
          <>
            At your pace you&apos;ll finish around <b className="text-ink">{formatDate(d.est.date, { day: "numeric", month: "short", year: "numeric" })}</b> (≈ {d.est.weeks} weeks).{" "}
            {!d.start && (
              <Link href="/settings" className="underline">
                Set a start date
              </Link>
            )}
          </>
        ) : (
          "Every task is resolved."
        )}
      </p>
    </Card>
  );
}

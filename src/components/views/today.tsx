"use client";
import { Bot, Play, Square, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Badge, Button, Card, Checkbox, PageHeader, Progress } from "@/components/ui";
import { Loading, TaskItem } from "@/components/domain";
import { DailyGoalCard, FinishCard, Heatmap } from "@/components/daily";
import { PushPanel } from "@/components/push";
import { fmtElapsed } from "@/components/shell/status";
import { useDerived, useLS, useNow, useTasks, useWeek } from "@/lib/client/hooks";
import { useLearning } from "@/lib/client/store";
import { IDX } from "@/lib/roadmap/client-index";
import { formatDate } from "@/lib/dates";
import { allProblemStatuses, revisionQueue } from "@/lib/dsa/engine";
import { currentDayIdx, dailyActivity, dayProgress, deferredTasks, gatePassed, isResolved, statusOf } from "@/lib/state/selectors";

export function TodayView({ gateWarning, dayComplete }: { gateWarning: string; dayComplete: string }) {
  const { hydrated, state, dispatch, today } = useLS();
  const { timer, startTimer, stopTimer } = useLearning(useShallow((s) => ({ timer: s.timer, startTimer: s.startTimer, stopTimer: s.stopTimer })));
  const now = useNow(1000);
  const t = today();
  const d = useDerived((s, today) => {
    const dayIdx = currentDayIdx(s);
    const day = IDX.days[dayIdx];
    const ids = day.taskIds;
    const problemIds = [...new Set(IDX.dayTasks(dayIdx).flatMap((x) => x.problemIds))];
    const statuses = allProblemStatuses(s, IDX.dsa.map((x) => x.id), today);
    const phaseIdx = IDX.phases.findIndex((p) => p.id === day.phase);
    const prevGate = IDX.gates.filter((g) => IDX.phases.findIndex((p) => p.id === g.phase) < phaseIdx).at(-1);
    return {
      dayIdx, day, ids, prog: dayProgress(s, dayIdx), act: dailyActivity(s)[today], problems: problemIds.map((id) => ({ id, st: statuses.get(id)! })),
      due: revisionQueue(statuses.values(), 0), deferred: deferredTasks(s), projects: [...new Set(IDX.dayTasks(dayIdx).map((x) => x.project).filter(Boolean))] as string[],
      warn: prevGate && !gatePassed(s, prevGate.phase) ? gateWarning.replace("{PHASE}", day.phase).replace("{PREV}", prevGate.phase) : null,
      nextDay: IDX.days[dayIdx + 1],
    };
  }, [gateWarning]);
  const week = useWeek(d.day.week);
  const deferredTexts = useTasks(d.deferred.slice(0, 20).map((x) => x.id));
  const mustOnly = state.prefs.mustOnly;
  const tasks = useMemo(() => (week ? d.ids.map((id) => week.tasks.find((x) => x.id === id)!).filter(Boolean) : []), [week, d.ids]);
  const shown = mustOnly ? tasks.filter((x) => x.priority === "M" || statusOf(state, x.id) !== "not_started") : tasks;
  if (!hydrated) return <Loading />;
  const allResolved = d.ids.every((id) => isResolved(state, id));
  return (
    <>
      <PageHeader eyebrow={`${formatDate(t, { weekday: "long", day: "numeric", month: "long" })} · Phase ${d.day.phase}`} title={`W${d.day.week} · D${d.day.day} — ${d.day.title}`} lead={week?.objective}>
        <Link href={`/roadmap/${d.day.week}`} className="self-center text-sm text-muted hover:text-ink">
          Week plan →
        </Link>
      </PageHeader>

      {d.warn && (
        <div className="mb-4 flex gap-2.5 rounded-lg border border-accent/40 bg-accent-soft px-3.5 py-2.5 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent" />
          <span>
            {d.warn}{" "}
            <Link href="/assessments" className="underline">
              Open gates
            </Link>
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-2.5">
            <div className="min-w-40 flex-1">
              <div className="flex justify-between text-xs text-muted">
                <span>
                  {d.prog.done}/{d.prog.total} tasks · {d.prog.minutesDone}/{d.prog.minutesTotal} min
                </span>
                <span>{d.prog.pct}%</span>
              </div>
              <Progress value={d.prog.pct} className="mt-1.5" tone={d.prog.pct === 100 ? "good" : "accent"} />
            </div>
            <Checkbox checked={mustOnly} onChange={(v) => dispatch("PREFERENCES_UPDATED", { patch: { mustOnly: v } })} label={<span className="text-xs">Must-only</span>} />
          </div>
          {!week ? (
            <Loading />
          ) : (
            <ul className="space-y-2">
              {shown.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </ul>
          )}
          {mustOnly && shown.length < tasks.length && <p className="text-xs text-muted">{tasks.length - shown.length} Should/Nice tasks hidden by must-only mode. Skipping them is your call — they stay on this day until resolved.</p>}
          <Card title="Activity" action={<span className="text-xs text-faint">last 18 weeks</span>}>
            <Heatmap />
          </Card>
          {allResolved && (
            <Card title="Day complete">
              <p className="text-sm">{dayComplete}</p>
              <p className="mt-2 text-sm text-muted">Your position moved on automatically{d.nextDay ? ` to W${d.nextDay.week} D${d.nextDay.day}` : ""}. Refresh or keep going.</p>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card title="Focus timer">
            <div className="font-mono text-2xl tabular-nums">{timer ? fmtElapsed(now - Date.parse(timer.startedAt)) : "0:00"}</div>
            <div className="mt-1 text-xs text-muted">Logged today: {d.act?.studyMinutes ?? 0} min. Timer minutes never count toward the streak on their own.</div>
            <div className="mt-3 flex gap-2">
              {timer ? (
                <>
                  <Button variant="primary" onClick={() => stopTimer()}>
                    <Square className="size-3.5" /> Stop & log
                  </Button>
                  <Button variant="ghost" onClick={() => stopTimer({ discard: true })}>
                    Discard
                  </Button>
                </>
              ) : (
                <Button variant="primary" onClick={() => startTimer(d.ids.find((id) => !isResolved(state, id)))}>
                  <Play className="size-3.5" /> Start
                </Button>
              )}
            </div>
          </Card>
          <DailyGoalCard />
          {d.problems.length > 0 && (
            <Card title="DSA today">
              <ul className="space-y-1.5 text-sm">
                {d.problems.map(({ id, st }) => (
                  <li key={id} className="flex items-center justify-between gap-2">
                    <Link href={`/dsa?problem=${id}`} className="truncate hover:underline">
                      {IDX.dsa.find((x) => x.id === id)?.name}
                    </Link>
                    <Badge tone={st.solved ? "good" : st.attempted ? "accent" : "neutral"}>{st.solved ? "solved" : st.attempted ? "attempted" : "new"}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Revision" action={<Link href="/revision" className="text-xs text-muted hover:text-ink">Open →</Link>}>
            <p className="text-sm">{d.due.length ? `${d.due.length} DSA revision${d.due.length > 1 ? "s" : ""} due.` : "No DSA revisions due today."}</p>
          </Card>
          {d.projects.length > 0 && (
            <Card title="Project context">
              {d.projects.map((id) => (
                <Link key={id} href={`/projects/${id}`} className="block text-sm hover:underline">
                  {IDX.existingProjects.find((p) => p.id === id)?.name}
                </Link>
              ))}
            </Card>
          )}
          {d.deferred.length > 0 && (
            <Card title={`Deferred (${d.deferred.length})`}>
              <ul className="space-y-2 text-sm">
                {d.deferred.slice(0, 6).map((x) => (
                  <li key={x.id} className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="text-xs text-faint">
                        W{x.week} D{x.day}{" "}
                      </span>
                      <span className="line-clamp-2">{deferredTexts.get(x.id)?.text.split(/(?<=\.)\s/)[0] ?? "…"}</span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => dispatch("TASK_STARTED", { taskId: x.id })}>
                      Resume
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Save to GitHub">
            <PushPanel compact />
          </Card>
          <FinishCard />
        </aside>
      </div>
    </>
  );
}

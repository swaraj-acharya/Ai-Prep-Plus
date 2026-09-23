"use client";
import dynamic from "next/dynamic";
import { Card, Empty, PageHeader, Progress, Stat } from "@/components/ui";
import { Loading } from "@/components/domain";
import { useDerived, useLS } from "@/lib/client/hooks";
import { addDays, dateRange, formatDate, weekStart } from "@/lib/dates";
import { TASK_TYPE_LABEL } from "@/lib/roadmap/constants";
import { dailyActivity, streakInfo, typeProgress } from "@/lib/state/selectors";

const BarSeries = dynamic(() => import("./charts").then((m) => m.BarSeries), { ssr: false, loading: () => <div className="h-[200px]" /> });
const LineSeries = dynamic(() => import("./charts").then((m) => m.LineSeries), { ssr: false, loading: () => <div className="h-[200px]" /> });

export function AnalyticsView() {
  const { hydrated } = useLS();
  const d = useDerived((s, today) => {
    const act = dailyActivity(s);
    const last60 = dateRange(addDays(today, -59), today).map((date) => ({ date: formatDate(date, { day: "numeric", month: "short" }), tasks: act[date]?.tasksCompleted ?? 0 }));
    const weeks: Record<string, number> = {};
    for (const a of Object.values(act)) {
      const w = weekStart(a.date);
      if (w >= weekStart(addDays(today, -7 * 11))) weeks[w] = (weeks[w] ?? 0) + a.studyMinutes;
    }
    const weekly = dateRange(weekStart(addDays(today, -7 * 11)), weekStart(today)).filter((_, i) => i % 7 === 0).map((w) => ({ week: formatDate(w, { day: "numeric", month: "short" }), minutes: weeks[w] ?? 0 }));
    const firsts = new Map<string, string>();
    for (const x of Object.values(s.dsaAttempts).sort((a, b) => (a.at < b.at ? -1 : 1))) if (x.outcome === "solved" && !firsts.has(x.problemId)) firsts.set(x.problemId, x.date);
    const byDate: Record<string, number> = {};
    for (const date of firsts.values()) byDate[date] = (byDate[date] ?? 0) + 1;
    let cum = 0;
    const dsa = Object.keys(byDate).sort().map((date) => ({ date: formatDate(date, { day: "numeric", month: "short" }), solved: (cum += byDate[date]) }));
    const last30 = dateRange(addDays(today, -29), today);
    const st = streakInfo(s, today);
    const active30 = last30.filter((x) => st.activeDates.includes(x)).length;
    const activeAll = Object.values(act).filter((a) => a.tasksCompleted > 0);
    return {
      last60, weekly, dsa, active30, st,
      avgTasks: activeAll.length ? (activeAll.reduce((a, x) => a + x.tasksCompleted, 0) / activeAll.length).toFixed(1) : "0",
      avgMinutes: Math.round(weekly.reduce((a, w) => a + w.minutes, 0) / 12),
      types: Object.keys(TASK_TYPE_LABEL).map((t) => ({ t, p: typeProgress(s, t) })),
    };
  });
  if (!hydrated) return <Loading />;
  return (
    <>
      <PageHeader title="Analytics" lead="Only the numbers that change what you do next: consistency, pace, and where the effort is going." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active days, last 30" value={`${d.active30}/30`} sub={`${Math.round((100 * d.active30) / 30)}% consistency`} />
        <Stat label="Tasks per active day" value={d.avgTasks} />
        <Stat label="Focus minutes / week" value={d.avgMinutes} sub="12-week average (timer + logged)" />
        <Stat label="Longest streak" value={`${d.st.longest}d`} sub={`${d.st.activeDays} active days total`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Tasks completed — last 60 days">
          <BarSeries data={d.last60} x="date" y="tasks" />
        </Card>
        <Card title="Focus minutes per week">
          <BarSeries data={d.weekly} x="week" y="minutes" color="var(--info)" />
        </Card>
        <Card title="DSA problems solved (cumulative)">{d.dsa.length ? <LineSeries data={d.dsa} x="date" y="solved" /> : <Empty title="No solved problems yet" />}</Card>
        <Card title="Progress by task type">
          <ul className="space-y-2.5">
            {d.types.map(({ t, p }) => (
              <li key={t} className="grid grid-cols-[6rem_1fr_4.5rem] items-center gap-3 text-sm">
                <span>{TASK_TYPE_LABEL[t]}</span>
                <Progress value={p.pct} />
                <span className="text-right font-mono text-xs text-muted">
                  {p.done}/{p.total}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

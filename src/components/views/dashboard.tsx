"use client";
import { Bot, Flame, Target } from "lucide-react";
import Link from "next/link";
import { Badge, Card, LinkButton, PageHeader, Progress, Stat } from "@/components/ui";
import { Loading, YearMap } from "@/components/domain";
import { useDerived, useLS, useTasks } from "@/lib/client/hooks";
import { PushPanel } from "@/components/push";
import { Heatmap } from "@/components/daily";
import { IDX } from "@/lib/roadmap/client-index";
import { GATE_STATUS_LABEL } from "@/lib/roadmap/constants";
import { formatDate } from "@/lib/dates";
import { allProblemStatuses, dsaSummary, revisionQueue } from "@/lib/dsa/engine";
import { recommend } from "@/lib/projects/engine";
import { scoreboard } from "@/lib/state/scoreboard";
import { currentDayIdx, currentTask, estimatedCompletion, gateStatus, nextTasks, overallProgress, phaseProgress, streakInfo } from "@/lib/state/selectors";

export function Dashboard({ tips, dailyLoop }: { tips: string[]; dailyLoop: string }) {
  const { hydrated } = useLS();
  const d = useDerived((s, today) => {
    const dayIdx = currentDayIdx(s);
    const cur = currentTask(s);
    const statuses = allProblemStatuses(s, IDX.dsa.map((x) => x.id), today);
    return {
      dayIdx, day: IDX.days[dayIdx], cur, next: nextTasks(s, cur, 3), overall: overallProgress(s), streak: streakInfo(s, today), est: estimatedCompletion(s, today),
      dsa: dsaSummary(statuses.values()), due: revisionQueue(statuses.values(), 0).slice(0, 5),
      phases: IDX.phases.map((p) => ({ ...p, prog: phaseProgress(s, p.id), gate: gateStatus(s, p.id) })),
      rec: recommend(s, { limit: 1 })[0], score: scoreboard(s, today)
    };
  });
  const texts = useTasks([d.cur?.id, ...d.next.map((t) => t.id)].filter(Boolean) as string[]);
  if (!hydrated) return <Loading />;
  const phase = IDX.phases.find((p) => p.id === d.day.phase)!;
  const tip = tips[d.dayIdx % tips.length];
  const head = (id?: string) => (id ? texts.get(id)?.text.split(/(?<=\.)\s/)[0] ?? "…" : "");
  return (
    <>
      <PageHeader eyebrow={`Phase ${phase.id} · ${phase.name}`} title={`Week ${d.day.week}, day ${d.day.day} — ${d.day.title}`} lead={tip}>
        <LinkButton href="/today" variant="primary">
          <Target className="size-4" /> Open today
        </LinkButton>
        <LinkButton href="/tutor">
          <Bot className="size-4" /> Study with Claude
        </LinkButton>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Roadmap progress" value={`${d.overall.pct}%`} sub={`${d.overall.done.toLocaleString()} of ${d.overall.total.toLocaleString()} tasks`} />
        <Stat
          label="Study streak"
          value={
            <span className="inline-flex items-center gap-1.5">
              <Flame className={d.streak.todayActive ? "size-4 text-accent" : "size-4 text-faint"} />
              {d.streak.current}d
            </span>
          }
          sub={`Today ${d.streak.unitsToday}/${d.streak.threshold} units · best ${d.streak.longest}d`}
        />
        <Stat label="DSA solved" value={`${d.dsa.solved}/${IDX.dsa.length}`} sub={`${d.dsa.revisionDue} revisions due · ${d.dsa.retained} retained`} />
        <Stat label="Projected finish" value={d.est.date ? formatDate(d.est.date, { month: "short", year: "numeric" }) : "Done"} sub={d.est.date ? `≈ ${d.est.weeks} weeks at your pace` : "All tasks resolved"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Year map" action={<Link href="/roadmap" className="text-xs text-muted hover:text-ink">Roadmap →</Link>}>
          <YearMap current={d.dayIdx} />
          <p className="mt-3 text-xs text-muted">{dailyLoop}</p>
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-2 text-xs text-muted">Daily activity — last 18 weeks</div>
            <Heatmap />
          </div>
        </Card>
        <Card title="Up next" action={<Link href="/today" className="text-xs text-muted hover:text-ink">Today →</Link>}>
          {d.cur ? (
            <ol className="space-y-2.5 text-sm">
              <li>
                <div className="text-xs text-accent">Current · W{d.cur.week} D{d.cur.day}</div>
                <div>{head(d.cur.id)}</div>
              </li>
              {d.next.map((t) => (
                <li key={t.id} className="text-muted">
                  <div className="text-xs text-faint">
                    W{t.week} D{t.day} · {t.minutes} min
                  </div>
                  {head(t.id)}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">Every task is resolved. Final readiness and the year-2 horizon are next.</p>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Phases" className="lg:col-span-2">
          <ul className="space-y-3">
            {d.phases.map((p) => (
              <li key={p.id} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 text-sm">
                <span className="font-mono text-xs text-muted">{p.id}</span>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="font-mono text-xs text-muted">{p.prog.pct}%</span>
                  </div>
                  <Progress value={p.prog.pct} className="mt-1" tone={p.prog.pct === 100 ? "good" : "accent"} />
                </div>
                {IDX.gates.some((g) => g.phase === p.id) ? (
                  <Link href={`/assessments#${p.id}`}>
                    <Badge tone={p.gate === "passed" ? "good" : p.gate === "needs_revisit" ? "bad" : p.gate === "in_progress" ? "accent" : "neutral"}>gate: {GATE_STATUS_LABEL[p.gate].toLowerCase()}</Badge>
                  </Link>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Revision due" action={<Link href="/revision" className="text-xs text-muted hover:text-ink">Revision →</Link>}>
          {d.due.length ? (
            <ul className="space-y-2 text-sm">
              {d.due.map((p) => (
                <li key={p.problemId} className="flex items-center justify-between gap-2">
                  <Link href={`/dsa?problem=${p.problemId}`} className="truncate hover:underline">
                    {IDX.dsa.find((x) => x.id === p.problemId)?.name}
                  </Link>
                  <Badge tone={p.dueInDays! < 0 ? "bad" : "accent"}>{p.dueInDays! < 0 ? `${-p.dueInDays!}d overdue` : "due today"}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing due. Revisions appear 1, 7, 21 and 30 days after you first solve a problem.</p>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Learning scoreboard" className="lg:col-span-2" action={<span className="text-xs text-faint">capability + effort, per area</span>}>
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {d.score.map((a) => (
              <li key={a.id} title={a.evidence.join("\n")}>
                <div className="flex justify-between text-sm">
                  <span>{a.label}</span>
                  <span className="font-mono text-xs text-muted">{a.pct}%</span>
                </div>
                <Progress value={a.pct} className="mt-1" />
                <div className="mt-0.5 truncate text-[11px] text-faint">{a.evidence[0]}</div>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-4">
          <Card title="Build next" action={<Link href="/projects/pick" className="text-xs text-muted hover:text-ink">Pick →</Link>}>
            {d.rec ? (
              <div className="text-sm">
                <Link href={`/projects/${d.rec.project.slug}`} className="font-medium hover:underline">
                  {d.rec.project.name}
                </Link>
                <div className="mt-1 flex gap-1.5">
                  <Badge>Tier {d.rec.project.tier}</Badge>
                  <Badge>
                    {d.rec.project.hours[0]}–{d.rec.project.hours[1]} h
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted">{d.rec.reasons[0]}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">Projects unlock as the roadmap teaches their material. Browse the Lab any time.</p>
            )}
          </Card>
          <Card title="Save to GitHub">
            <PushPanel compact />
          </Card>
        </div>
      </div>
    </>
  );
}

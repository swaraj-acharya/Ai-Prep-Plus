"use client";
import { Bot, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, cx, PageHeader, Progress, Tabs } from "@/components/ui";
import { Loading, NoteField, TaskItem } from "@/components/domain";
import { useDerived, useLS, useWeek } from "@/lib/client/hooks";
import { RESOURCES } from "@/lib/client/resources";
import { resourcesForWeek } from "@/lib/resources";
import { IDX } from "@/lib/roadmap/client-index";
import { currentDayIdx, dayProgress, weekProgress } from "@/lib/state/selectors";

type Tab = "plan" | "details" | "review";

export function WeekView({ n, defaultTab = "plan", highlightTask }: { n: number; defaultTab?: Tab; highlightTask?: string }) {
  const { hydrated } = useLS();
  const w = useWeek(n);
  const [tab, setTab] = useState<Tab>(defaultTab);
  const d = useDerived((s) => ({ prog: weekProgress(s, n), days: IDX.days.filter((x) => x.week === n).map((x) => ({ ...x, prog: dayProgress(s, x.idx) })), cur: currentDayIdx(s) }), [n]);
  const [openDay, setOpenDay] = useState<number | null>(null);
  useEffect(() => {
    if (highlightTask) {
      const day = Number(/d(\d+)/.exec(highlightTask)?.[1]);
      setOpenDay(day);
      setTab("plan");
      setTimeout(() => document.getElementById(highlightTask)?.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
    }
  }, [highlightTask]);
  if (!w || !hydrated) return <Loading />;
  const curDay = IDX.days[d.cur];
  const defaultOpen = openDay ?? (curDay.week === n ? curDay.day : null);
  const phase = IDX.phases.find((p) => p.id === w.phase)!;
  return (
    <>
      <PageHeader eyebrow={`Phase ${phase.id} · ${phase.name} · ${w.hours} h planned`} title={`Week ${n} — ${w.title}`} lead={w.objective}>
        {n > 1 && (
          <Link href={`/roadmap/${n - 1}`} className="inline-flex h-9 items-center rounded-md border border-line px-2.5 text-sm text-muted hover:text-ink" aria-label="Previous week">
            <ChevronLeft className="size-4" />
          </Link>
        )}
        {n < 52 && (
          <Link href={`/roadmap/${n + 1}`} className="inline-flex h-9 items-center rounded-md border border-line px-2.5 text-sm text-muted hover:text-ink" aria-label="Next week">
            <ChevronRight className="size-4" />
          </Link>
        )}
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Tabs value={tab} onChange={setTab} items={[{ value: "plan", label: "Daily plan" }, { value: "details", label: "Topics & resources" }, { value: "review", label: "Weekly review" }]} />
        <div className="min-w-48 flex-1">
          <div className="flex justify-between text-xs text-muted">
            <span>
              {d.prog.done}/{d.prog.total} tasks
            </span>
            <span>{d.prog.pct}%</span>
          </div>
          <Progress value={d.prog.pct} className="mt-1" />
        </div>
      </div>

      {tab === "plan" && (
        <div className="space-y-2">
          {w.days.map((day) => {
            const p = d.days.find((x) => x.day === day.d)!.prog;
            const tasks = day.taskIds.map((id) => w.tasks.find((t) => t.id === id)!);
            return (
              <details key={day.d} open={defaultOpen === day.d} className="group rounded-lg border border-line bg-surface">
                <summary className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className={cx("font-mono text-xs", curDay.week === n && curDay.day === day.d ? "text-accent" : "text-muted")}>D{day.d}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{day.title}</span>
                  <span className="hidden font-mono text-xs text-muted sm:inline">{day.minutes} min</span>
                  <Badge tone={p.pct === 100 ? "good" : p.done ? "accent" : "neutral"}>
                    {p.done}/{p.total}
                  </Badge>
                </summary>
                <ul className="space-y-2 border-t border-line p-2.5">
                  {tasks.map((t) => (
                    <TaskItem key={t.id} task={t} highlight={t.id === highlightTask} />
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      )}

      {tab === "details" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Topics">
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {w.topics.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Card>
          <Card title="Theory & practice">
            <p className="text-sm">
              <span className="text-muted">Theory:</span> {w.theory}
            </p>
            <p className="mt-2 text-sm">
              <span className="text-muted">Practice:</span> {w.practice}
            </p>
          </Card>
          <Card title="Deliverables">
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {w.deliverables.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Card>
          <Card title="Checkpoint — prove it without notes">
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {w.checkpoint.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Card>
          <WeekResourcesCard n={n} scheduled={w.resources} />
        </div>
      )}

      {tab === "review" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Knowledge questions">
            <ol className="list-decimal space-y-1.5 pl-4 text-sm">
              {w.review.knowledge.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </Card>
          <Card title="Practical retest">
            <ol className="list-decimal space-y-1.5 pl-4 text-sm">
              {w.review.practical.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
            <Link href={`/tutor?prompt=weekly&week=${n}`} className="mt-3 inline-flex items-center gap-1 text-xs text-info hover:underline">
              <Bot className="size-3.5" /> Run the weekly review with Claude
            </Link>
          </Card>
          <Card title="Reflection" className="md:col-span-2">
            <div className="grid gap-3 md:grid-cols-3">
              <NoteField noteKey={`review:W${n}:struggled`} label="What I struggled with" />
              <NoteField noteKey={`review:W${n}:learned`} label="What I learned" />
              <NoteField noteKey={`review:W${n}:improve`} label="What I'll do differently" />
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function ResLink({ name, url, sub, badge }: { name: string; url?: string; sub?: string; badge?: React.ReactNode }) {
  return (
    <li className="text-sm">
      <span className="flex items-start gap-1.5">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
            {name}
            <ExternalLink className="ml-1 inline size-3 align-[-1px] text-faint" />
          </a>
        ) : (
          <span className="font-medium">{name}</span>
        )}
        {badge}
      </span>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </li>
  );
}

function WeekResourcesCard({ n, scheduled }: { n: number; scheduled: string[] }) {
  const r = resourcesForWeek(n, scheduled, RESOURCES);
  return (
    <Card title="Resources" className="md:col-span-2" action={<Link href="/resources" className="text-xs text-muted hover:text-ink">All resources →</Link>}>
      <h3 className="mb-2 text-xs font-semibold text-muted">Scheduled this week</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {r.scheduled.map((k) => (
          <ResLink key={k} name={RESOURCES[k]?.name ?? k} url={RESOURCES[k]?.url} sub={RESOURCES[k]?.use} />
        ))}
      </ul>
      {r.library.length > 0 && (
        <>
          <h3 className="mb-2 mt-4 text-xs font-semibold text-muted">Also in your library for week {n}</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {r.library.map((k) => (
              <ResLink key={k} name={RESOURCES[k].name} url={RESOURCES[k].url} sub={RESOURCES[k].use} />
            ))}
          </ul>
        </>
      )}
      {r.curated.length > 0 && (
        <>
          <h3 className="mb-2 mt-4 text-xs font-semibold text-muted">Curated additions for this week</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {r.curated.map((c) => (
              <ResLink key={c.key} name={c.name} url={c.url} sub={c.use} badge={<Badge tone="info">Added</Badge>} />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

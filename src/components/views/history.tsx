"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Button, Card, cx, Empty, inputCls, PageHeader } from "@/components/ui";
import { Loading } from "@/components/domain";
import { Heatmap } from "@/components/daily";
import { useDerived, useLS, useTasks } from "@/lib/client/hooks";
import { useLearning } from "@/lib/client/store";
import { addDays } from "@/lib/dates";
import { IDX } from "@/lib/roadmap/client-index";
import { LAB_BY_ID } from "@/data/projects/lab";
import { buildHistory, HISTORY_FILTERS, HISTORY_LABEL, longDate, matchesFilter, refName, type HistoryEntry, type HistoryFilter, type HistoryKind } from "@/lib/history";
import { reduceEvents } from "@/lib/state/reducer";
import { currentDayIdx, overallProgress } from "@/lib/state/selectors";

const PAGE = 14;
const TONE: Partial<Record<HistoryKind, "good" | "accent" | "bad" | "info">> = {
  task: "good", dsa_solved: "good", dsa_revised: "info", dsa_forgot: "bad", dsa_attempt: "accent", mastery: "accent", gate: "accent", gate_revisit: "bad", project: "info", reflection: "info",
};

function hrefOf(e: HistoryEntry): string {
  switch (e.kind) {
    case "task": {
      const t = IDX.byId.get(e.ref);
      return t ? `/roadmap/${t.week}?task=${e.ref}` : "/roadmap";
    }
    case "dsa_solved": case "dsa_attempt": case "dsa_revised": case "dsa_forgot": return `/dsa?problem=${e.ref}`;
    case "mastery": return `/mastery#${e.ref}`;
    case "gate": case "gate_revisit": return `/assessments#${e.ref}`;
    case "project": return `/projects/${LAB_BY_ID.get(e.ref)?.slug ?? e.ref}`;
    case "reflection": return `/roadmap/${e.ref}?tab=review`;
  }
}

/** Day-by-day history, newest first — the same view as the reference PrepBoard, for the whole roadmap. */
export function HistoryView() {
  const { hydrated, today } = useLS();
  const events = useLearning((s) => s.events);
  const rev = useLearning((s) => s.rev);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const all = useDerived((s) => buildHistory(s));
  const t = today();

  const taskIds = useMemo(() => all.slice(0, shown).flatMap((d) => d.entries.filter((e) => e.kind === "task").map((e) => e.ref)), [all, shown]);
  const texts = useTasks(taskIds);
  const days = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .map((d) => ({
        ...d,
        entries: d.entries.filter((e) => {
          if (!matchesFilter(e.kind, filter)) return false;
          if (!needle) return true;
          return `${refName(e)} ${texts.get(e.ref)?.text ?? ""} ${HISTORY_LABEL[e.kind]} ${e.detail ?? ""}`.toLowerCase().includes(needle);
        }),
      }))
      .filter((d) => d.entries.length);
  }, [all, filter, q, texts]);

  // End-of-day position for the days on screen, rebuilt from the event log alone.
  const endOfDay = useMemo(() => {
    const list = [...events.values()];
    const out = new Map<string, { week: number; day: number; pct: number }>();
    for (const d of days.slice(0, shown)) {
      const s = reduceEvents(list.filter((e) => e.localDate <= d.day));
      const pos = IDX.days[currentDayIdx(s)];
      out.set(d.day, { week: pos.week, day: pos.day, pct: overallProgress(s).pct });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, shown, rev]);

  if (!hydrated) return <Loading />;
  const totals = all.reduce((a, d) => ({ tasks: a.tasks + d.tasks, solved: a.solved + d.solved, revised: a.revised + d.revised, goal: a.goal + (d.goalMet ? 1 : 0) }), { tasks: 0, solved: 0, revised: 0, goal: 0 });
  const rel = (day: string) => (day === t ? "Today" : day === addDays(t, -1) ? "Yesterday" : null);

  return (
    <>
      <PageHeader
        title="History"
        lead={
          all.length ? (
            `${totals.tasks} tasks completed, ${totals.solved} DSA problems solved and ${totals.revised} revised over ${all.length} active day${all.length === 1 ? "" : "s"} — daily goal met on ${totals.goal}.`
          ) : (
            <>
              Nothing here yet. Everything you complete, solve, revise or pass is saved under the day you did it. Start with <Link href="/today" className="underline">Today</Link>.
            </>
          )
        }
      />
      <Card className="mb-5" title="Activity" action={<span className="text-xs text-faint">click a day to jump to it</span>}>
        <Heatmap />
      </Card>
      {all.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Show" className="inline-flex rounded-md border border-line bg-surface p-0.5">
            {HISTORY_FILTERS.map(([k, label]) => (
              <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className={cx("rounded px-2.5 py-1 text-xs font-medium", filter === k ? "bg-surface-2 text-ink" : "text-muted hover:text-ink")}>
                {label}
              </button>
            ))}
          </div>
          <input className={cx(inputCls, "w-full sm:w-72")} type="search" placeholder="Search by task, problem or topic" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search history" />
        </div>
      )}
      {all.length > 0 && !days.length && <Empty title="No days match">Clear the search or choose Everything.</Empty>}
      <ol className="space-y-4">
        {days.slice(0, shown).map((d) => {
          const eod = endOfDay.get(d.day);
          const r = rel(d.day);
          return (
            <li key={d.day} id={`d-${d.day}`} className="scroll-mt-20 rounded-lg border border-line bg-surface">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
                <h2 className="font-semibold">
                  {r ? (
                    <>
                      {r} <span className="text-sm font-normal text-muted">{longDate(d.day)}</span>
                    </>
                  ) : (
                    longDate(d.day)
                  )}
                </h2>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  {[d.tasks && `${d.tasks} task${d.tasks === 1 ? "" : "s"}`, d.solved && `${d.solved} solved`, d.revised && `${d.revised} revised`, d.minutes && `${d.minutes} min`].filter(Boolean).join(" · ")}
                  <Badge tone={d.goalMet ? "good" : "neutral"}>
                    {d.units}/{d.goal} {d.goalMet ? "goal met" : "units"}
                  </Badge>
                </span>
              </div>
              <ul className="divide-y divide-line">
                {d.entries.map((e, i) => (
                  <li key={`${e.kind}:${e.ref}:${i}`} className="flex items-start gap-3 px-4 py-2 text-sm">
                    <Badge tone={TONE[e.kind]} className="mt-0.5 w-32 justify-center">
                      {HISTORY_LABEL[e.kind]}
                    </Badge>
                    <Link href={hrefOf(e)} className="min-w-0 flex-1 hover:underline">
                      {e.kind === "task" ? (
                        <>
                          <span className="mr-1.5 font-mono text-xs text-muted">{refName(e)}</span>
                          {texts.get(e.ref)?.text.split(/(?<=\.)\s/)[0] ?? "…"}
                        </>
                      ) : (
                        <>
                          {refName(e)}
                          {e.kind === "project" && <span className="text-muted"> → {e.detail}</span>}
                          {e.minutes !== undefined && <span className="ml-1.5 text-xs text-muted">{e.minutes} min · {e.detail}</span>}
                        </>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
              {eod && (
                <div className="border-t border-line px-4 py-2 text-xs text-faint">
                  End of day: W{eod.week} D{eod.day} · {eod.pct}% of the roadmap
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {days.length > shown && (
        <Button className="mt-4" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, days.length - shown)} older days
        </Button>
      )}
    </>
  );
}

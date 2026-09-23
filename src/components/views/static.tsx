"use client";
import Link from "next/link";
import { Badge, Button, Card, PageHeader, Progress, Stat } from "@/components/ui";
import { CheckList, Loading } from "@/components/domain";
import { useDerived, useLS, useTasks } from "@/lib/client/hooks";
import { RESOURCES } from "@/lib/client/resources";
import { IDX } from "@/lib/roadmap/client-index";
import { addDays, diffDays } from "@/lib/dates";
import { allProblemStatuses, revisionQueue } from "@/lib/dsa/engine";
import type { Roadmap, SideTrack } from "@/lib/roadmap/types";
import { checklistProgress, currentDayIdx, deferredTasks, finalKeys, gapSinceLastActivity, sideTrackKeys, statusOf } from "@/lib/state/selectors";
import { useState } from "react";

export function ReadinessView({ groups, lead }: { groups: Roadmap["finalReadiness"]; lead: string }) {
  const { hydrated } = useLS();
  const d = useDerived((s) => groups.map((g) => checklistProgress(s, finalKeys(g.category))), [groups]);
  if (!hydrated) return <Loading />;
  const done = d.reduce((a, x) => a + x.done, 0);
  const total = d.reduce((a, x) => a + x.total, 0);
  return (
    <>
      <PageHeader title="Final readiness" lead={lead} />
      <Card className="mb-4">
        <div className="flex justify-between text-sm">
          <span>
            {done}/{total} items
          </span>
          <span className="font-mono text-xs text-muted">{Math.round((100 * done) / Math.max(1, total))}%</span>
        </div>
        <Progress value={(100 * done) / Math.max(1, total)} className="mt-2" />
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g, i) => (
          <Card key={g.id} id={g.id} title={g.category} action={<span className="font-mono text-xs text-muted">{d[i].done}/{d[i].total}</span>}>
            <CheckList items={g.items} scope="final" keyOf={(j) => `fn:${g.category}:${j}`} />
          </Card>
        ))}
      </div>
    </>
  );
}

export function TrackView({ track, lead }: { track: SideTrack; lead: string }) {
  const { hydrated } = useLS();
  const d = useDerived((s) => ({ all: checklistProgress(s, sideTrackKeys(track.id)), mods: track.modules.map((_, i) => checklistProgress(s, sideTrackKeys(track.id, i))) }), [track.id]);
  if (!hydrated) return <Loading />;
  return (
    <>
      <PageHeader eyebrow={lead} title={`${track.emoji} ${track.name}`} lead={track.note} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Checks done" value={`${d.all.done}/${d.all.total}`} />
        <Stat label="Modules" value={track.modules.length} sub={track.hours} />
        <Stat label="Counts toward roadmap" value={track.countsTowardRoadmap ? "Yes" : "No"} sub={track.countsTowardRoadmap ? "Supporting tasks appear in your weekly plan" : "Optional side track"} />
      </div>
      <div className="space-y-3">
        {track.modules.map((m, i) => (
          <details key={m.title} id={`m${i}`} className="rounded-lg border border-line bg-surface" open={d.mods[i].done > 0 && d.mods[i].done < d.mods[i].total}>
            <summary className="flex items-center gap-3 px-4 py-3">
              <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1 text-sm font-medium">{m.title}</span>
              <span className="text-xs text-muted">{m.hours} h</span>
              <Badge tone={d.mods[i].pct === 100 ? "good" : d.mods[i].done ? "accent" : "neutral"}>
                {d.mods[i].done}/{d.mods[i].total}
              </Badge>
            </summary>
            <div className="space-y-3 border-t border-line px-4 py-3 text-sm">
              <p>
                <span className="text-muted">Learn: </span>
                {m.learn}
              </p>
              <p>
                <span className="text-muted">Do: </span>
                {m.do}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {m.res.map((k) =>
                  RESOURCES[k]?.url ? (
                    <a key={k} href={RESOURCES[k].url} target="_blank" rel="noreferrer" className="text-info hover:underline">
                      {RESOURCES[k].name}
                    </a>
                  ) : (
                    <span key={k}>{RESOURCES[k]?.name ?? k}</span>
                  ),
                )}
              </div>
              <CheckList items={m.check} scope="side" keyOf={(j) => `st:${track.id}:${i}:${j}`} />
            </div>
          </details>
        ))}
      </div>
    </>
  );
}

export function RecoveryPanel({ recovery }: { recovery: Roadmap["recovery"] }) {
  const { hydrated, state, dispatch, today } = useLS();
  const [confirm, setConfirm] = useState(false);
  const d = useDerived((s, t) => {
    const dayIdx = currentDayIdx(s);
    const expected = s.prefs.startDate ? Math.min(363, Math.max(0, diffDays(s.prefs.startDate, t))) : null;
    const due = revisionQueue(allProblemStatuses(s, IDX.dsa.map((x) => x.id), t).values(), 0);
    const upcoming = IDX.days.slice(dayIdx, dayIdx + 7).flatMap((dd) => IDX.dayTasks(dd.idx));
    const niceOpen = upcoming.filter((x) => x.priority === "N" && statusOf(s, x.id) === "not_started");
    return { dayIdx, gap: gapSinceLastActivity(s, t), behind: expected === null ? null : expected - dayIdx, due: due.length, overdue: due.filter((x) => x.dueInDays! < 0).length, deferred: deferredTasks(s).length, niceOpen, skipped: IDX.tasks.filter((x) => statusOf(s, x.id) === "skipped").length };
  });
  const niceTexts = useTasks(confirm ? d.niceOpen.map((x) => x.id) : []);
  if (!hydrated) return <Loading />;
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Days since last study" value={d.gap ?? "—"} />
        <Stat label="Behind calendar" value={d.behind === null ? "—" : d.behind > 0 ? `${d.behind} days` : "on track"} sub={state.prefs.startDate ? `start date ${state.prefs.startDate}` : "set a start date in Settings"} />
        <Stat label="DSA revisions due" value={d.due} sub={`${d.overdue} overdue`} />
        <Stat label="Deferred / skipped" value={`${d.deferred} / ${d.skipped}`} />
      </div>
      <Card title="Your catch-up actions" className="mb-5">
        <ol className="list-decimal space-y-2 pl-4 text-sm">
          <li>
            Turn on must-only mode for a week.{" "}
            <Button size="sm" variant={state.prefs.mustOnly ? "good" : "default"} onClick={() => dispatch("PREFERENCES_UPDATED", { patch: { mustOnly: !state.prefs.mustOnly } })}>
              {state.prefs.mustOnly ? "Must-only is on" : "Enable must-only"}
            </Button>
          </li>
          <li>
            Clear overdue DSA revisions first — they decay fastest. <Link href="/revision" className="text-info hover:underline">Open revision</Link>
          </li>
          <li>
            Defer the {d.niceOpen.length} nice-to-have tasks in your next 7 roadmap days. Nothing is deleted; they stay visible as deferred.{" "}
            {!confirm ? (
              <Button size="sm" disabled={!d.niceOpen.length} onClick={() => setConfirm(true)}>
                Review & defer
              </Button>
            ) : (
              <span className="mt-2 block rounded-md border border-line p-2.5">
                <ul className="mb-2 max-h-40 list-disc overflow-y-auto pl-4 text-xs text-muted scroll-thin">
                  {d.niceOpen.map((x) => (
                    <li key={x.id}>
                      W{x.week}D{x.day}: {niceTexts.get(x.id)?.text.split(/(?<=\.)\s/)[0] ?? x.id}
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="primary" onClick={() => { d.niceOpen.forEach((x) => dispatch("TASK_DEFERRED", { taskId: x.id, reason: "recovery" })); setConfirm(false); }}>
                  Defer {d.niceOpen.length} tasks
                </Button>{" "}
                <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                  Cancel
                </Button>
              </span>
            )}
          </li>
          <li>
            Pick up exactly where you stopped: <Link href="/today" className="text-info hover:underline">W{IDX.days[d.dayIdx].week} D{IDX.days[d.dayIdx].day}</Link>. The roadmap never moves without you.
          </li>
        </ol>
        <p className="mt-2 text-xs text-muted">Today is {today()} ({addDays(today(), 0)}). Gate status and mastery never change during recovery.</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["Never skip", recovery.never_skip],
            ["Compress", recovery.compress],
            ["Postpone", recovery.postpone],
            ["Skip temporarily", recovery.skip_temporarily],
            ["Catch-up plan", recovery.catch_up],
            ["Rules", recovery.rules],
          ] as const
        ).map(([t, list]) => (
          <Card key={t} title={t}>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {list.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}

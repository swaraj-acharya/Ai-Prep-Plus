"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, cx, LinkButton, PageHeader, Progress } from "@/components/ui";
import { Loading, YearMap } from "@/components/domain";
import { useDerived, useLS } from "@/lib/client/hooks";
import { GATE_STATUS_LABEL } from "@/lib/roadmap/constants";
import type { Phase } from "@/lib/roadmap/types";
import { currentDayIdx, gateStatus, phaseProgress, weekProgress } from "@/lib/state/selectors";
import { IDX } from "@/lib/roadmap/client-index";

export function RoadmapView({ phases, weeks, gates, note }: { phases: Phase[]; weeks: { n: number; phase: string; title: string; objective: string; hours: number }[]; gates: { phase: string; week: number; title: string }[]; note: string }) {
  const { hydrated } = useLS();
  const d = useDerived((s) => ({ cur: currentDayIdx(s), weeks: weeks.map((w) => weekProgress(s, w.n)), phases: phases.map((p) => phaseProgress(s, p.id)), gates: gates.map((g) => gateStatus(s, g.phase)) }));
  if (!hydrated) return <Loading />;
  const curWeek = IDX.days[d.cur].week;
  return (
    <>
      <PageHeader title="Roadmap" lead="52 weeks in 9 phases. Your position follows completion, not the calendar — the amber cell is the first unfinished day.">
        <LinkButton href="/roadmap/dependencies">Dependency map</LinkButton>
        <LinkButton href="/certifications">Certifications</LinkButton>
      </PageHeader>
      <Card className="mb-5">
        <YearMap current={d.cur} />
      </Card>
      <div className="space-y-5">
        {phases.map((p, pi) => {
          const gi = gates.findIndex((g) => g.phase === p.id);
          return (
            <section key={p.id} id={p.id} className="rounded-lg border border-line bg-surface">
              <header className="border-b border-line px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted">{p.id}</span>
                  <h2 className="font-semibold">{p.name}</h2>
                  <span className="text-xs text-muted">
                    W{p.weeks[0]}–W{p.weeks[p.weeks.length - 1]}
                  </span>
                  <span className="ml-auto font-mono text-xs text-muted">{d.phases[pi].pct}%</span>
                </div>
                <p className="mt-1 text-sm text-muted">{p.goal}</p>
                <Progress value={d.phases[pi].pct} className="mt-2" tone={d.phases[pi].pct === 100 ? "good" : "accent"} />
              </header>
              <ul className="divide-y divide-line">
                {weeks
                  .filter((w) => w.phase === p.id)
                  .map((w) => {
                    const wp = d.weeks[w.n - 1];
                    return (
                      <li key={w.n}>
                        <Link href={`/roadmap/${w.n}`} className="grid grid-cols-[3rem_1fr_5rem] items-center gap-3 px-4 py-2.5 hover:bg-surface-2 sm:grid-cols-[3rem_1fr_4rem_8rem]">
                          <span className={cx("font-mono text-xs", w.n === curWeek ? "text-accent" : "text-muted")}>W{w.n}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{w.title}</span>
                          </span>
                          <span className="hidden font-mono text-xs text-muted sm:block">{w.hours}h</span>
                          <span className="flex items-center gap-2">
                            <Progress value={wp.pct} tone={wp.pct === 100 ? "good" : "accent"} />
                            <span className="w-8 text-right font-mono text-[11px] text-muted">{wp.pct}%</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                {gi >= 0 && (
                  <li className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-12 font-mono text-xs text-muted">gate</span>
                    <Link href={`/assessments#${p.id}`} className="flex-1 hover:underline">
                      {gates[gi].title}
                    </Link>
                    <Badge tone={d.gates[gi] === "passed" ? "good" : d.gates[gi] === "needs_revisit" ? "bad" : "neutral"}>{GATE_STATUS_LABEL[d.gates[gi]]}</Badge>
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted">{note}</p>
    </>
  );
}

export function DependencyMap({ nodes, edges, help, phases }: { nodes: { id: string; label: string; phase: string; week: number }[]; edges: [string, string][]; help: string; phases: { id: string; name: string }[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const done = useDerived((s) => new Set(nodes.filter((n) => weekProgress(s, n.week).pct === 100).map((n) => n.id)), []);
  const related = useMemo(() => {
    if (!sel) return { up: new Set<string>(), down: new Set<string>() };
    const walk = (start: string, dir: 0 | 1) => {
      const out = new Set<string>();
      const stack = [start];
      while (stack.length) {
        const cur = stack.pop()!;
        for (const e of edges) if (e[dir === 0 ? 1 : 0] === cur && !out.has(e[dir])) { out.add(e[dir]); stack.push(e[dir]); }
      }
      return out;
    };
    return { up: walk(sel, 0), down: walk(sel, 1) };
  }, [sel, edges]);
  return (
    <>
      <PageHeader title="Dependency map" lead={help} />
      <div className="overflow-x-auto pb-2 scroll-thin">
        <div className="flex w-max gap-3">
          {phases.map((p) => (
            <div key={p.id} className="w-48">
              <div className="mb-2 text-xs text-muted">
                <span className="font-mono">{p.id}</span> {p.name}
              </div>
              <div className="space-y-1.5">
                {nodes
                  .filter((n) => n.phase === p.id)
                  .map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setSel(sel === n.id ? null : n.id)}
                      className={cx(
                        "block w-full rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                        sel === n.id ? "border-accent bg-accent-soft" : related.up.has(n.id) ? "border-info bg-info-soft" : related.down.has(n.id) ? "border-line-strong bg-surface-2" : "border-line bg-surface",
                        sel && sel !== n.id && !related.up.has(n.id) && !related.down.has(n.id) && "opacity-40",
                      )}
                    >
                      <span className={cx("mr-1 inline-block size-1.5 rounded-full", done.has(n.id) ? "bg-good" : "bg-line-strong")} />
                      {n.label}
                      <span className="ml-1 text-faint">W{n.week}</span>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {sel && (
        <p className="mt-3 text-sm text-muted">
          <span className="text-info">Blue</span> = what “{nodes.find((n) => n.id === sel)?.label}” depends on ({related.up.size}); outlined = what depends on it ({related.down.size}).
        </p>
      )}
    </>
  );
}

"use client";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Card, cx, Empty, inputCls, PageHeader, Progress, Stat, Tabs } from "@/components/ui";
import { CURATED, CURATED_AREAS, CURATED_CHECKED_ON, type CuratedResource } from "@/data/resources/curated";
import { formatWeeks } from "@/lib/resources";
import { CheckList, Loading, NoteField, TaskItem } from "@/components/domain";
import { useDerived, useLS, useWeek } from "@/lib/client/hooks";
import { IDX } from "@/lib/roadmap/client-index";
import { GATE_STATUS_LABEL } from "@/lib/roadmap/constants";
import type { Assessment, Mastery, Resource } from "@/lib/roadmap/types";
import { allProblemStatuses, revisionQueue } from "@/lib/dsa/engine";
import { currentDayIdx, gateCriteriaMet, gateStatus, masteryItemsDone, masteryStatus, statusOf, type MasteryStatus } from "@/lib/state/selectors";

const MASTERY_LABEL: Record<MasteryStatus, string> = { not_started: "Not started", in_progress: "In progress", ready_to_confirm: "Ready to confirm", mastered: "Mastered", needs_revisit: "Needs revisit" };
const masteryTone = (s: MasteryStatus) => (s === "mastered" ? "good" : s === "ready_to_confirm" ? "accent" : s === "needs_revisit" ? "bad" : s === "in_progress" ? "info" : "neutral") as "good";

export function RevisionView({ howItWorks }: { howItWorks: string[] }) {
  const { hydrated } = useLS();
  const d = useDerived((s, today) => {
    const st = allProblemStatuses(s, IDX.dsa.map((x) => x.id), today);
    const all = revisionQueue(st.values(), 14);
    const week = IDX.days[currentDayIdx(s)].week;
    return { overdue: all.filter((x) => x.dueInDays! < 0), today: all.filter((x) => x.dueInDays === 0), upcoming: all.filter((x) => x.dueInDays! > 0), week, reviseIds: IDX.weekTasks(week).filter((t) => t.type === "revise" && statusOf(s, t.id) !== "completed").map((t) => t.id), mastery: IDX.mastery.filter((m) => m.week <= week + 1).map((m) => ({ ...m, status: masteryStatus(s, m.id) })).filter((m) => m.status !== "mastered") };
  });
  const w = useWeek(d.week);
  if (!hydrated) return <Loading />;
  const list = (title: string, items: typeof d.overdue, tone: "bad" | "accent" | "neutral") => (
    <Card title={`${title} (${items.length})`}>
      {items.length ? (
        <ul className="space-y-1.5 text-sm">
          {items.map((p) => (
            <li key={p.problemId} className="flex items-center justify-between gap-2">
              <Link href={`/dsa?problem=${p.problemId}`} className="truncate hover:underline">
                {IDX.dsa.find((x) => x.id === p.problemId)?.name}
              </Link>
              <Badge tone={tone}>
                stage {p.stage + 1} · {p.nextDue}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">None.</p>
      )}
    </Card>
  );
  return (
    <>
      <PageHeader title="Revision" lead="Spaced revision keeps what you learned. DSA revisions are scheduled from your first solve; roadmap revision tasks and mastery checkpoints sit alongside them." />
      <div className="grid gap-4 md:grid-cols-3">
        {list("Overdue", d.overdue, "bad")}
        {list("Due today", d.today, "accent")}
        {list("Next 14 days", d.upcoming, "neutral")}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={`Revision tasks this week (W${d.week})`}>
          {!w ? <Loading /> : d.reviseIds.length ? (
            <ul className="space-y-2">
              {d.reviseIds.map((id) => (
                <TaskItem key={id} task={w.tasks.find((t) => t.id === id)!} showDay />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">All revision tasks for this week are done.</p>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Open mastery checkpoints" action={<Link href="/mastery" className="text-xs text-muted hover:text-ink">Mastery →</Link>}>
            {d.mastery.length ? (
              <ul className="space-y-1.5 text-sm">
                {d.mastery.map((m) => (
                  <li key={m.id} className="flex justify-between gap-2">
                    <Link href={`/mastery#${m.id}`} className="hover:underline">
                      {m.name}
                    </Link>
                    <Badge tone={masteryTone(m.status)}>{MASTERY_LABEL[m.status]}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No open checkpoints up to this week.</p>
            )}
          </Card>
          <Card title="How revision works">
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
              {howItWorks.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

export function MasteryView({ items, lead }: { items: Mastery[]; lead: string }) {
  const { hydrated, state, dispatch } = useLS();
  const d = useDerived((s) => items.map((m) => ({ id: m.id, status: masteryStatus(s, m.id), done: masteryItemsDone(s, m.id) })), [items]);
  if (!hydrated) return <Loading />;
  const mastered = d.filter((x) => x.status === "mastered").length;
  return (
    <>
      <PageHeader title="Mastery checkpoints" lead={lead} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Mastered" value={`${mastered}/${items.length}`} />
        <Stat label="Ready to confirm" value={d.filter((x) => x.status === "ready_to_confirm").length} />
        <Stat label="In progress" value={d.filter((x) => x.status === "in_progress").length} />
        <Stat label="Needs revisit" value={d.filter((x) => x.status === "needs_revisit").length} />
      </div>
      <p className="mb-4 text-xs text-muted">Finishing a week's tasks never marks mastery. Check each item only when you can do it from memory, then confirm.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((m, i) => {
          const x = d[i];
          return (
            <Card
              key={m.id}
              id={m.id}
              title={
                <span className="flex items-center gap-2">
                  {m.name} <span className="text-xs font-normal text-muted">{m.week}</span>
                </span>
              }
              action={<Badge tone={masteryTone(x.status)}>{MASTERY_LABEL[x.status]}</Badge>}
            >
              <CheckList items={m.items} scope="mastery" keyOf={(j) => `ms:${m.id}:${j}`} />
              <div className="mt-3 flex items-center gap-2">
                {x.status !== "mastered" ? (
                  <Button size="sm" variant="good" disabled={x.done < m.items.length} onClick={() => dispatch("MASTERY_CONFIRMED", { masteryId: m.id })}>
                    Confirm mastery
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => dispatch("MASTERY_REVOKED", { masteryId: m.id })}>
                    Re-open (needs revisit)
                  </Button>
                )}
                <span className="text-xs text-muted">
                  {x.done}/{m.items.length} items
                  {state.mastery[m.id]?.date && x.status === "mastered" ? ` · confirmed ${state.mastery[m.id].date}` : ""}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

export function AssessmentsView({ gates, lead }: { gates: Assessment[]; lead: string }) {
  const { hydrated, state, dispatch } = useLS();
  const d = useDerived((s) => gates.map((g) => ({ status: gateStatus(s, g.phase), met: gateCriteriaMet(s, g.phase) })), [gates]);
  if (!hydrated) return <Loading />;
  return (
    <>
      <PageHeader title="Phase gates" lead={lead} />
      <p className="mb-4 text-xs text-muted">Gates never pass automatically. Check every pass criterion honestly, then mark the gate passed. A failed gate is information, not a verdict.</p>
      <div className="space-y-4">
        {gates.map((g, i) => {
          const x = d[i];
          const hist = state.gates[g.phase]?.history ?? [];
          return (
            <Card
              key={g.phase}
              id={g.phase}
              title={
                <span>
                  <span className="mr-2 font-mono text-xs text-muted">{g.phase}</span>
                  {g.title} <span className="ml-1 text-xs font-normal text-muted">· week {g.week}</span>
                </span>
              }
              action={<Badge tone={x.status === "passed" ? "good" : x.status === "needs_revisit" ? "bad" : x.status === "in_progress" ? "accent" : "neutral"}>{GATE_STATUS_LABEL[x.status]}</Badge>}
            >
              <div className="grid gap-4 md:grid-cols-2">
                {(
                  [
                    ["Knowledge", g.knowledge],
                    ["Coding", g.coding],
                    ["Practical", g.practical],
                    ["Explain out loud", g.explain],
                  ] as const
                ).map(([t, list]) =>
                  list.length ? (
                    <div key={t}>
                      <div className="mb-1 text-xs font-medium text-muted">{t}</div>
                      <ul className="list-disc space-y-1 pl-4 text-sm">
                        {list.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null,
                )}
              </div>
              <div className="mt-4 rounded-md border border-line p-3">
                <div className="mb-1 text-xs font-medium text-muted">Pass criteria</div>
                <CheckList items={g.pass_criteria} scope="gate" keyOf={(j) => `as:${g.phase}:pc${j}`} />
              </div>
              {g.fail.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="text-xs text-muted hover:text-ink">If you don't pass →</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {g.fail.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="mt-3">
                <NoteField noteKey={`weak:${g.phase}`} label="Weak areas to revisit" rows={2} placeholder="What felt shaky? These notes feed your recovery plan." />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {x.status === "not_started" && (
                  <Button size="sm" onClick={() => dispatch("ASSESSMENT_STARTED", { phase: g.phase })}>
                    Start gate
                  </Button>
                )}
                {x.status !== "passed" && (
                  <Button size="sm" variant="good" disabled={!x.met} title={x.met ? "" : "Check every pass criterion first"} onClick={() => dispatch("ASSESSMENT_PASSED", { phase: g.phase })}>
                    Mark passed
                  </Button>
                )}
                {x.status !== "needs_revisit" && x.status !== "not_started" && (
                  <Button size="sm" variant="danger" onClick={() => dispatch("ASSESSMENT_NEEDS_REVISIT", { phase: g.phase })}>
                    Needs revisit
                  </Button>
                )}
                {x.status !== "not_started" && (
                  <Button size="sm" variant="ghost" onClick={() => dispatch("ASSESSMENT_RESET", { phase: g.phase })}>
                    Reset
                  </Button>
                )}
                <Link href={`/tutor?prompt=review&week=${g.week}`} className="text-xs text-info hover:underline">
                  Mock this gate with Claude →
                </Link>
              </div>
              {hist.length > 0 && (
                <div className="mt-3 text-xs text-muted">
                  History: {hist.map((h) => `${h.date} ${GATE_STATUS_LABEL[h.status].toLowerCase()}`).join(" · ")}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

const monthsAgo = (d: string) => (Date.parse(CURATED_CHECKED_ON) - Date.parse(d)) / (30 * 24 * 3600 * 1000);
const fmtMonth = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

function LibraryCard({ k, r }: { k: string; r: Resource & { linkNote?: string } }) {
  return (
    <li id={k} className="scroll-mt-20 rounded-lg border border-line bg-surface p-3.5 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-2">
        {r.url ? (
          <a href={r.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
            {r.name}
            <ExternalLink className="ml-1 inline size-3 align-[-1px] text-faint" />
          </a>
        ) : (
          <span className="font-medium">{r.name}</span>
        )}
        <Badge>{r.type}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted">{r.use}</p>
      <div className="mt-1.5 text-xs text-faint">Weeks: {r.weeks}</div>
      {r.linkNote && <div className="mt-1 text-xs text-info">{r.linkNote}</div>}
    </li>
  );
}

function CuratedCard({ c }: { c: CuratedResource }) {
  const first = c.weeks[0];
  return (
    <li id={c.key} className="scroll-mt-20 rounded-lg border border-line bg-surface p-3.5 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-2">
        <a href={c.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
          {c.name}
          <ExternalLink className="ml-1 inline size-3 align-[-1px] text-faint" />
        </a>
        <span className="flex shrink-0 gap-1">
          <Badge tone="info">Added</Badge>
          <Badge>{c.type}</Badge>
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">{c.use}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
        {first && (
          <Link href={`/roadmap/${first}?tab=details`} className="hover:underline">
            Weeks: {formatWeeks(c.weeks)}
          </Link>
        )}
        {c.repo && (
          <span className={cx(c.lastCommit && monthsAgo(c.lastCommit) <= 6 ? "text-good" : "")}>
            github.com/{c.repo}
            {c.lastCommit ? ` · updated ${fmtMonth(c.lastCommit)}` : ""}
          </span>
        )}
      </div>
    </li>
  );
}

type ResTab = "library" | "curated" | "all";
export function ResourcesView({ resources, lead }: { resources: Record<string, Resource & { linkNote?: string }>; lead: string }) {
  const [tab, setTab] = useState<ResTab>("library");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [area, setArea] = useState<string>("");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "curated" || t === "all") setTab(t);
    const hash = window.location.hash.slice(1);
    if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: "center" }), 250);
  }, []);
  const entries = Object.entries(resources);
  const types = [...new Set(entries.map(([, r]) => r.type))].sort();
  const needle = q.trim().toLowerCase();
  const lib = entries.filter(([k, r]) => (!type || r.type === type) && (!needle || `${r.name} ${r.use} ${k} ${r.weeks}`.toLowerCase().includes(needle)));
  const cur = CURATED.filter((c) => (!area || c.area === area) && (!needle || `${c.name} ${c.use} ${c.area} ${c.type} ${c.repo ?? ""}`.toLowerCase().includes(needle)));
  const grouped = !needle && !area;
  return (
    <>
      <PageHeader title="Resources" lead={lead} />
      <p className="-mt-3 mb-5 text-sm text-muted">
        {entries.length} resources from your roadmap, plus {CURATED.length} curated additions — free, maintained and matched to roadmap weeks. GitHub repos were checked on {CURATED_CHECKED_ON}.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "library", label: `Roadmap library (${entries.length})` },
            { value: "curated", label: `Curated additions (${CURATED.length})` },
            { value: "all", label: "All" },
          ]}
        />
        <input className={cx(inputCls, "w-full sm:w-72")} placeholder="Search resources…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search resources" />
      </div>
      {tab !== "curated" && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Button size="sm" variant={!type ? "primary" : "default"} onClick={() => setType("")}>
            All types
          </Button>
          {types.map((t) => (
            <Button key={t} size="sm" variant={type === t ? "primary" : "default"} onClick={() => setType(t)}>
              {t}
            </Button>
          ))}
        </div>
      )}
      {tab === "curated" && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Button size="sm" variant={!area ? "primary" : "default"} onClick={() => setArea("")}>
            All areas
          </Button>
          {CURATED_AREAS.map((a) => (
            <Button key={a} size="sm" variant={area === a ? "primary" : "default"} onClick={() => setArea(a)}>
              {a}
            </Button>
          ))}
        </div>
      )}
      {tab !== "curated" && (
        <>
          {tab === "all" && <h2 className="mb-2 text-sm font-semibold">From your roadmap</h2>}
          {lib.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {lib.map(([k, r]) => (
                <LibraryCard key={k} k={k} r={r} />
              ))}
            </ul>
          ) : (
            <Empty title="No roadmap resources match" />
          )}
        </>
      )}
      {tab !== "library" && (
        <div className={cx(tab === "all" && "mt-8")}>
          {tab === "all" && <h2 className="mb-2 text-sm font-semibold">Curated additions</h2>}
          {!cur.length ? (
            <Empty title="No curated resources match" />
          ) : grouped && tab === "curated" ? (
            CURATED_AREAS.map((a) => {
              const list = cur.filter((c) => c.area === a);
              if (!list.length) return null;
              return (
                <section key={a} className="mb-6">
                  <h2 className="mb-2 text-sm font-semibold">
                    {a} <span className="font-normal text-muted">· {list.length}</span>
                  </h2>
                  <ul className="grid gap-3 md:grid-cols-2">
                    {list.map((c) => (
                      <CuratedCard key={c.key} c={c} />
                    ))}
                  </ul>
                </section>
              );
            })
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {cur.map((c) => (
                <CuratedCard key={c.key} c={c} />
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

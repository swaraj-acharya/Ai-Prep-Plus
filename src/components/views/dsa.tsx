"use client";
import { ExternalLink, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge, Button, Card, cx, inputCls, Modal, PageHeader, selectCls, Stat } from "@/components/ui";
import { DsaLogDialog, Loading } from "@/components/domain";
import { useDerived, useLS } from "@/lib/client/hooks";
import { IDX } from "@/lib/roadmap/client-index";
import { MISTAKE_TYPES } from "@/lib/roadmap/constants";
import { formatDate } from "@/lib/dates";
import { allProblemStatuses, dsaSummary, type ProblemStatus } from "@/lib/dsa/engine";

type Filter = "all" | "unsolved" | "solved" | "due" | "retained";
const mistakeLabel = (id: string) => MISTAKE_TYPES.find((m) => m.id === id)?.label ?? id;

function statusBadge(st: ProblemStatus) {
  if (st.retained) return <Badge tone="good">retained</Badge>;
  if (st.dueInDays !== undefined && st.dueInDays <= 0) return <Badge tone={st.dueInDays < 0 ? "bad" : "accent"}>{st.dueInDays < 0 ? `revise · ${-st.dueInDays}d late` : "revise today"}</Badge>;
  if (st.solved) return <Badge tone="good">solved</Badge>;
  if (st.attempted) return <Badge tone="accent">attempted</Badge>;
  return <Badge>new</Badge>;
}

export function DsaView({ note }: { note: string }) {
  const { hydrated } = useLS();
  const sp = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [diff, setDiff] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [b75, setB75] = useState(false);
  const [logFor, setLogFor] = useState<string | null>(sp.get("log") === "1" ? "" : null);
  const d = useDerived((s, today) => {
    const st = allProblemStatuses(s, IDX.dsa.map((x) => x.id), today);
    return { st, sum: dsaSummary(st.values()) };
  });
  const cats = useMemo(() => [...new Set(IDX.dsa.map((x) => x.category))], []);
  const rows = IDX.dsa.filter((p) => {
    const st = d.st.get(p.id)!;
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (cat && p.category !== cat) return false;
    if (diff && p.difficulty !== diff) return false;
    if (b75 && !p.blind75) return false;
    if (filter === "unsolved" && st.solved) return false;
    if (filter === "solved" && !st.solved) return false;
    if (filter === "due" && !(st.dueInDays !== undefined && st.dueInDays <= 0)) return false;
    if (filter === "retained" && !st.retained) return false;
    return true;
  });
  const openId = sp.get("problem");
  const open = openId ? IDX.dsa.find((p) => p.id === openId) : undefined;
  if (!hydrated) return <Loading />;
  const setProblem = (id: string | null) => router.replace(id ? `/dsa?problem=${id}` : "/dsa", { scroll: false });
  return (
    <>
      <PageHeader title="DSA tracker" lead={note}>
        <Button variant="primary" onClick={() => setLogFor("")}>
          <Plus className="size-4" /> Log attempt
        </Button>
      </PageHeader>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Solved" value={`${d.sum.solved}/${IDX.dsa.length}`} />
        <Stat label="First-pass solves" value={d.sum.firstPassSolved} />
        <Stat label="Cold solves" value={d.sum.coldSolved} />
        <Stat label="Revisions due" value={d.sum.revisionDue} sub={`${d.sum.revisionsCompleted} completed`} />
        <Stat label="Fully retained" value={d.sum.retained} sub={`${d.sum.totalAttempts} attempts logged`} />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input className={cx(inputCls, "w-full sm:w-56")} placeholder="Filter problems…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter problems" />
        <select className={selectCls} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className={selectCls} value={diff} onChange={(e) => setDiff(e.target.value)} aria-label="Difficulty">
          <option value="">Any difficulty</option>
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
        <select className={selectCls} value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Status">
          <option value="all">All statuses</option>
          <option value="unsolved">Unsolved</option>
          <option value="solved">Solved</option>
          <option value="due">Revision due</option>
          <option value="retained">Retained</option>
        </select>
        <Button variant={b75 ? "primary" : "default"} onClick={() => setB75((v) => !v)}>
          Blind 75
        </Button>
        <span className="self-center text-xs text-muted">{rows.length} problems</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface scroll-thin">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Problem</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Attempts</th>
              <th className="px-3 py-2 font-medium">Next revision</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => {
              const st = d.st.get(p.id)!;
              return (
                <tr key={p.id} className="hover:bg-surface-2/50">
                  <td className="px-3 py-2">
                    <button className="text-left hover:underline" onClick={() => setProblem(p.id)}>
                      {p.name}
                    </button>
                    <div className="mt-0.5 flex gap-1">
                      <Badge tone={p.difficulty === "Hard" ? "bad" : p.difficulty === "Medium" ? "accent" : "good"}>{p.difficulty}</Badge>
                      {p.blind75 && <Badge tone="info">B75</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted">{p.category}</td>
                  <td className="px-3 py-2">{statusBadge(st)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{st.attempts.length}</td>
                  <td className="px-3 py-2 text-xs text-muted">{st.nextDue ? formatDate(st.nextDue, { day: "numeric", month: "short" }) : st.retained ? "done" : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" onClick={() => setLogFor(p.id)}>
                      Log
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal open onOpenChange={(v) => !v && setProblem(null)} wide title={open.name} description={`${open.difficulty} · ${open.category}${open.blind75 ? " · Blind 75" : ""}`}>
          <ProblemDetail id={open.id} st={d.st.get(open.id)!} onLog={() => setLogFor(open.id)} />
        </Modal>
      )}
      {logFor !== null && <DsaLogDialog problemId={logFor || undefined} onClose={() => setLogFor(null)} />}
    </>
  );
}

function ProblemDetail({ id, st, onLog }: { id: string; st: ProblemStatus; onLog: () => void }) {
  const p = IDX.dsa.find((x) => x.id === id)!;
  const tasks = IDX.tasks.filter((t) => t.problemIds.includes(id));
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2">
        {statusBadge(st)}
        {st.bestMinutes !== undefined && <Badge>best {st.bestMinutes} min</Badge>}
        {st.firstPassSolved && <Badge tone="good">first-pass</Badge>}
        {st.coldSolved && <Badge tone="good">cold solve</Badge>}
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={onLog}>
          Log attempt
        </Button>
        <a className="inline-flex h-7 items-center gap-1 rounded-md border border-line px-2.5 text-xs text-muted hover:text-ink" href={`https://leetcode.com/problemset/?search=${encodeURIComponent(p.name)}`} target="_blank" rel="noreferrer">
          Find on LeetCode <ExternalLink className="size-3" />
        </a>
      </div>
      {st.schedule.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted">Revision schedule (anchored on first solve {st.firstSolvedDate})</div>
          <ol className="flex flex-wrap gap-2">
            {st.schedule.map((r) => (
              <li key={r.stage}>
                <Badge tone={r.completedDate ? "good" : r.dueDate <= new Date().toISOString().slice(0, 10) ? "accent" : "neutral"}>
                  +{r.intervalDays}d · {r.completedDate ? `done ${r.completedDate}` : `due ${r.dueDate}`}
                </Badge>
              </li>
            ))}
          </ol>
          <p className="mt-1.5 text-xs text-muted">A revision completes only when you log a solved attempt on or after its due date. It never completes automatically.</p>
        </div>
      )}
      {Object.keys(st.mistakes).length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-muted">Mistake patterns</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(st.mistakes).map(([k, v]) => (
              <Badge key={k} tone="bad">
                {mistakeLabel(k)} × {v}
              </Badge>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="mb-1 text-xs font-medium text-muted">Attempts ({st.attempts.length})</div>
        {st.attempts.length ? (
          <ul className="divide-y divide-line rounded-md border border-line">
            {[...st.attempts].reverse().map((a) => (
              <li key={a.id} className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted">{a.date}</span>
                  <Badge>{a.mode}</Badge>
                  <Badge tone={a.outcome === "solved" ? "good" : a.outcome === "partial" ? "accent" : "bad"}>{a.outcome}</Badge>
                  <span className="text-xs text-muted">{a.minutes} min</span>
                  {a.mistakeType && <span className="text-xs text-bad">{mistakeLabel(a.mistakeType)}</span>}
                </div>
                {a.notes && <p className="mt-1 whitespace-pre-wrap text-muted">{a.notes}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No attempts yet.</p>
        )}
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-muted">Scheduled in the roadmap</div>
        <ul className="space-y-1">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link href={`/roadmap/${t.week}?task=${t.id}`} className="text-info hover:underline">
                W{t.week} D{t.day}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

"use client";
import { CircleCheck, Lock, Rocket, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Badge, Button, Card, Checkbox, cx, Empty, inputCls, LinkButton, PageHeader, Progress, selectCls, Stat } from "@/components/ui";
import { CheckList, Loading, NoteField } from "@/components/domain";
import { useDerived, useLS } from "@/lib/client/hooks";
import { RESOURCES } from "@/lib/client/resources";
import { curatedForProject } from "@/lib/resources";
import { IDX } from "@/lib/roadmap/client-index";
import { PROJECT_STATUS_LABEL } from "@/lib/roadmap/constants";
import { ARCH_LAYERS, LAB_BY_ID, LAB_CATEGORIES, LAB_CHAINS, LAB_PROJECTS, type LabCategory, type LabProject } from "@/data/projects/lab";
import type { ExistingProject } from "@/lib/roadmap/types";
import { EVIDENCE_FIELDS, PROJECT_STATUSES, type EvidenceField, type ProjectStatus } from "@/lib/state/events";
import {
  filterLab, labMilestoneKey, labQualityKey, portfolioStats, projectProgress, projectStatus, recommend, statusBlockers, unlockInfo, type LabFilter, type UnlockState,
} from "@/lib/projects/engine";
import { checklistProgress, existingProjectKeys, masteryStatus, weekProgress } from "@/lib/state/selectors";

const STATE_META: Record<UnlockState, { label: string; icon: typeof Lock; tone: "neutral" | "good" | "accent" | "info" }> = {
  locked: { label: "Locked", icon: Lock, tone: "neutral" },
  ready: { label: "Ready", icon: Star, tone: "info" },
  recommended: { label: "Recommended", icon: Star, tone: "accent" },
  in_progress: { label: "In progress", icon: Rocket, tone: "accent" },
  done: { label: "Completed", icon: CircleCheck, tone: "good" },
};
const safeHref = (v: string) => (/^https?:\/\//i.test(v.trim()) ? v.trim() : undefined);

function StateBadge({ state }: { state: UnlockState }) {
  const m = STATE_META[state];
  return (
    <Badge tone={m.tone}>
      <m.icon className="size-3" /> {m.label}
    </Badge>
  );
}

function ProjectCard({ p, state, status, recommended }: { p: LabProject; state: UnlockState; status: ProjectStatus; recommended?: boolean }) {
  return (
    <Link href={`/projects/${p.slug}`} className={cx("flex flex-col rounded-lg border bg-surface p-3.5 transition-colors hover:border-line-strong", recommended ? "border-accent/50" : "border-line")}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium leading-snug">{p.name}</span>
        <StateBadge state={recommended && state === "ready" ? "recommended" : state} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm text-muted">{p.objective}</p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
        <Badge>T{p.tier} · {p.tierName}</Badge>
        <Badge>
          {p.hours[0]}–{p.hours[1]} h
        </Badge>
        {p.categories.slice(0, 3).map((c) => (
          <Badge key={c} tone="info">
            {c}
          </Badge>
        ))}
        {p.startup && <Badge tone="accent">startup</Badge>}
        {status !== "idea" && <Badge tone="good">{PROJECT_STATUS_LABEL[status]}</Badge>}
      </div>
    </Link>
  );
}

export function ProjectLabView({ lead }: { lead: string }) {
  const { hydrated } = useLS();
  const [f, setF] = useState<LabFilter>({ state: "all" });
  const d = useDerived(
    (s) => {
      const recs = recommend(s, { limit: 3 });
      const recIds = new Set(recs.map((r) => r.project.id));
      const list = filterLab(s, f).map((p) => ({ p, u: unlockInfo(s, p), status: projectStatus(s, p.id), rec: recIds.has(p.id) }));
      const existing = IDX.existingProjects.map((p) => ({ ...p, status: projectStatus(s, p.id), prog: projectProgress(s, p.id) }));
      const chains = LAB_CHAINS.map((c) => ({ ...c, nodes: c.steps.map((id) => ({ id, name: LAB_BY_ID.get(id)?.name ?? IDX.existingProjects.find((x) => x.id === id)?.name.split(" — ")[0] ?? id, slug: LAB_BY_ID.get(id)?.slug ?? id, status: projectStatus(s, id) })) }));
      return { recs, list, existing, chains };
    },
    [JSON.stringify(f)],
  );
  if (!hydrated) return <Loading />;
  const toggle = <T,>(arr: T[] | undefined, v: T) => (arr?.includes(v) ? arr.filter((x) => x !== v) : [...(arr ?? []), v]);
  return (
    <>
      <PageHeader title="Project Lab" lead={lead}>
        <LinkButton href="/projects/pick" variant="primary">
          <Sparkles className="size-4" /> What should I build?
        </LinkButton>
        <LinkButton href="/projects/portfolio">Portfolio</LinkButton>
      </PageHeader>
      <p className="-mt-3 mb-5 text-xs text-muted">
        {LAB_PROJECTS.length} Lab projects beside the roadmap — they never add daily tasks. Locks are guidance: every project can be explored and started at any time.
      </p>

      {d.recs.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">Recommended now</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {d.recs.map((r) => (
              <div key={r.project.id} className="rounded-lg border border-accent/40 bg-surface p-3.5">
                <Link href={`/projects/${r.project.slug}`} className="font-medium hover:underline">
                  {r.project.name}
                </Link>
                <div className="mt-1 flex gap-1.5">
                  <Badge>T{r.project.tier}</Badge>
                  <Badge>
                    {r.project.hours[0]}–{r.project.hours[1]} h
                  </Badge>
                </div>
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted">
                  {r.reasons.slice(0, 3).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-4 space-y-2.5 rounded-lg border border-line bg-surface p-3">
        <div className="flex flex-wrap gap-2">
          <input className={cx(inputCls, "w-full sm:w-60")} placeholder="Search projects, tech, skills…" value={f.q ?? ""} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Search projects" />
          <select className={selectCls} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value as LabFilter["state"] })} aria-label="Unlock state">
            <option value="all">Any state</option>
            <option value="ready">Ready to start</option>
            <option value="locked">Locked</option>
            <option value="in_progress">In progress</option>
            <option value="done">Completed</option>
          </select>
          <select className={selectCls} value={f.maxHours ?? ""} onChange={(e) => setF({ ...f, maxHours: Number(e.target.value) || undefined })} aria-label="Time available">
            <option value="">Any size</option>
            <option value="10">≤ 10 h</option>
            <option value="25">≤ 25 h</option>
            <option value="50">≤ 50 h</option>
            <option value="100">≤ 100 h</option>
          </select>
          <select className={selectCls} value={f.phase ?? ""} onChange={(e) => setF({ ...f, phase: e.target.value || undefined })} aria-label="Phase">
            <option value="">Any phase</option>
            {IDX.phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} {p.short}
              </option>
            ))}
          </select>
          <Checkbox checked={!!f.prereqsMet} onChange={(v) => setF({ ...f, prereqsMet: v })} label={<span className="text-sm">Prerequisites met</span>} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4].map((t) => (
            <Button key={t} size="sm" variant={f.tiers?.includes(t) ? "primary" : "default"} onClick={() => setF({ ...f, tiers: toggle(f.tiers, t) })}>
              Tier {t}
            </Button>
          ))}
          <span className="mx-1 w-px self-stretch bg-line" />
          {LAB_CATEGORIES.map((c) => (
            <Button key={c} size="sm" variant={f.categories?.includes(c) ? "primary" : "ghost"} onClick={() => setF({ ...f, categories: toggle(f.categories, c as LabCategory) })}>
              {c}
            </Button>
          ))}
        </div>
      </section>
      {d.list.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.list.map(({ p, u, status, rec }) => (
            <ProjectCard key={p.id} p={p} state={u.state} status={status} recommended={rec} />
          ))}
        </div>
      ) : (
        <Empty title="No projects match these filters" />
      )}

      <h2 className="mb-2 mt-8 text-sm font-semibold">Project chains</h2>
      <div className="space-y-2">
        {d.chains.map((c) => (
          <div key={c.id} className="rounded-lg border border-line bg-surface p-3">
            <div className="text-sm font-medium">{c.name}</div>
            <div className="text-xs text-muted">{c.summary}</div>
            <ol className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              {c.nodes.map((n, i) => (
                <li key={n.id} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-faint">→</span>}
                  <Link href={`/projects/${n.slug}`} className={cx("rounded border px-1.5 py-0.5 hover:border-line-strong", ["completed", "shipped", "portfolio_ready"].includes(n.status) ? "border-good/50 text-good" : n.status === "in_progress" ? "border-accent/50 text-accent" : "border-line text-muted")}>
                    {n.name}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-8 text-sm font-semibold">Roadmap projects (scheduled in your weekly plan)</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {d.existing.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="rounded-lg border border-line bg-surface p-3.5 hover:border-line-strong">
            <div className="font-medium leading-snug">{p.name}</div>
            <div className="mt-1 flex gap-1.5">
              <Badge>{p.tier}</Badge>
              <Badge>W{p.weeks[0]}–W{p.weeks[p.weeks.length - 1]}</Badge>
              {p.status !== "idea" && <Badge tone="good">{PROJECT_STATUS_LABEL[p.status]}</Badge>}
            </div>
            <Progress value={p.prog.pct} className="mt-3" />
          </Link>
        ))}
      </div>
    </>
  );
}

// ───────────────────────────────────────────── detail pages
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold text-muted">{title}</h3>
      {children}
    </section>
  );
}
const Bullets = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-1 pl-4 text-sm">
    {items.map((x) => (
      <li key={x}>{x}</li>
    ))}
  </ul>
);

function StatusControl({ id, lab }: { id: string; lab?: LabProject }) {
  const { state, dispatch } = useLS();
  const [err, setErr] = useState<string[]>([]);
  const status = projectStatus(state, id);
  return (
    <div>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted">Status</span>
        <select
          className={selectCls}
          value={status}
          onChange={(e) => {
            const next = e.target.value as ProjectStatus;
            const blockers = lab ? statusBlockers(state, lab, next) : [];
            setErr(blockers);
            if (!blockers.length) dispatch("PROJECT_STATUS_SET", { projectId: id, status: next });
          }}
        >
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROJECT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      {err.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-xs text-bad">
          {err.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EvidenceForm({ id, fields }: { id: string; fields: { field: string; label: string; required: boolean }[] }) {
  const { state, dispatch } = useLS();
  const ev = state.projects[id]?.evidence ?? {};
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {fields.map((f) => {
        const cur = ev[f.field as EvidenceField]?.value ?? "";
        return (
          <label key={f.field} className="block text-sm">
            <span className="mb-1 flex items-center gap-1.5 text-xs text-muted">
              {f.label} {f.required && <Badge tone="accent">required</Badge>}
              {safeHref(cur) && (
                <a href={safeHref(cur)} target="_blank" rel="noreferrer" className="ml-auto text-info hover:underline">
                  open
                </a>
              )}
            </span>
            <input
              className={inputCls}
              defaultValue={cur}
              key={cur}
              placeholder="https://…"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== cur && (EVIDENCE_FIELDS as readonly string[]).includes(f.field)) dispatch("PROJECT_EVIDENCE_SET", { projectId: id, field: f.field as EvidenceField, value: v });
              }}
            />
          </label>
        );
      })}
    </div>
  );
}

export function LabProjectDetail({ id }: { id: string }) {
  const { hydrated } = useLS();
  const p = LAB_BY_ID.get(id)!;
  const [startup, setStartup] = useState(false);
  const d = useDerived(
    (s) => ({
      u: unlockInfo(s, p), status: projectStatus(s, p.id), ms: checklistProgress(s, p.milestones.map((_, i) => labMilestoneKey(p.id, i))), q: checklistProgress(s, p.quality.map((_, i) => labQualityKey(p.id, i))),
      weeks: p.roadmap.weeks.map((w) => ({ w, pct: weekProgress(s, w).pct })), mastery: p.roadmap.mastery.map((m) => ({ m, st: masteryStatus(s, m) })),
      prereqs: p.prerequisites.map((x) => ({ x, st: projectStatus(s, x) })), next: LAB_PROJECTS.filter((q) => q.prerequisites.includes(p.id)),
    }),
    [id],
  );
  if (!hydrated) return <Loading />;
  return (
    <>
      <PageHeader eyebrow={<Link href="/projects" className="hover:underline">Project Lab</Link>} title={p.name} lead={p.objective}>
        <StatusControl id={p.id} lab={p} />
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <StateBadge state={d.u.state} />
        <Badge>
          Tier {p.tier} · {p.tierName}
        </Badge>
        <Badge>
          {p.hours[0]}–{p.hours[1]} hours
        </Badge>
        {p.industry && <Badge>{p.industry}</Badge>}
        {p.categories.map((c) => (
          <Badge key={c} tone="info">
            {c}
          </Badge>
        ))}
      </div>
      {d.u.blockers.length > 0 && d.u.state === "locked" && (
        <div className="mb-4 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-sm">
          <div className="flex items-center gap-1.5 font-medium">
            <Lock className="size-3.5" /> Recommended to wait
          </div>
          <ul className="mt-1 list-disc pl-5 text-muted">
            {d.u.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">You can still explore or start it — locks only protect you from building on missing foundations.</p>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Card title="Problem & users">
            <p className="text-sm">{p.problem}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.users.map((u) => (
                <Badge key={u}>{u}</Badge>
              ))}
            </div>
          </Card>
          <Card title="Architecture">
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
              {ARCH_LAYERS.filter((l) => p.arch[l.key]).map((l) => (
                <div key={l.key} className="contents">
                  <dt className="text-muted">{l.label}</dt>
                  <dd>{p.arch[l.key]}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.tech.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          </Card>
          <Card title={`Milestones (${d.ms.done}/${d.ms.total})`}>
            <Progress value={d.ms.pct} className="mb-3" tone={d.ms.pct === 100 ? "good" : "accent"} />
            <CheckList items={p.milestones} scope="lab-milestone" keyOf={(i) => labMilestoneKey(p.id, i)} />
          </Card>
          <Card title="Features">
            <Bullets items={p.features} />
          </Card>
          <Card title="Engineering bar">
            <div className="grid gap-4 md:grid-cols-2">
              <Section title="Testing">
                <Bullets items={p.testing} />
              </Section>
              {p.observability && (
                <Section title="Observability">
                  <Bullets items={p.observability} />
                </Section>
              )}
              {p.security && (
                <Section title="Security">
                  <Bullets items={p.security} />
                </Section>
              )}
              {p.performance && (
                <Section title="Performance">
                  <Bullets items={p.performance} />
                </Section>
              )}
              <Section title="Deployment">
                <Bullets items={p.deployment} />
              </Section>
              <Section title="Benchmarks to publish">
                <Bullets items={p.benchmarks} />
              </Section>
            </div>
          </Card>
          <Card title="Evidence" action={<span className="text-xs text-faint">{p.tier >= 3 ? "required before it counts as complete" : "links to your work"}</span>}>
            <EvidenceForm id={p.id} fields={p.evidence} />
          </Card>
          {p.startup && (
            <Card title="Startup mode" action={<Button size="sm" variant={startup ? "primary" : "default"} onClick={() => setStartup((v) => !v)}>{startup ? "On" : "Off"}</Button>}>
              {startup ? (
                <dl className="space-y-2.5 text-sm">
                  {(
                    [
                      ["Why would someone pay?", p.startup.whyPay],
                      ["Alternatives", p.startup.alternatives],
                      ["MVP", p.startup.mvp],
                      ["Differentiator", p.startup.differentiator],
                      ["Pricing", p.startup.pricing],
                      ["Infrastructure cost", p.startup.infraCost],
                      ["Growth", p.startup.growth],
                      ["Moat", p.startup.moat],
                      ["Distribution", p.startup.distribution],
                      ["Risks", p.startup.risks],
                      ["Next experiment", p.startup.nextExperiment],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs font-medium text-muted">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted">Turn on to treat this as a company: who pays, pricing, infra cost, moat, distribution and the next experiment.</p>
              )}
            </Card>
          )}
          <Card title="Stretch goals">
            <Bullets items={p.stretch} />
          </Card>
          <Card title="Project notes">
            <NoteField noteKey={`project:${p.id}`} rows={4} placeholder="Decisions, blockers, links, what you'd do differently…" />
          </Card>
        </div>
        <aside className="space-y-4">
          <Card title="Roadmap links">
            <Section title="Weeks">
              <ul className="space-y-1 text-sm">
                {d.weeks.map(({ w, pct }) => (
                  <li key={w} className="flex items-center gap-2">
                    <Link href={`/roadmap/${w}`} className="min-w-0 flex-1 truncate hover:underline">
                      W{w} {IDX.weeks[w - 1].title}
                    </Link>
                    <span className="font-mono text-[11px] text-muted">{pct}%</span>
                  </li>
                ))}
              </ul>
            </Section>
            {d.mastery.length > 0 && (
              <div className="mt-3">
                <Section title="Mastery">
                  {d.mastery.map(({ m, st }) => (
                    <Link key={m} href={`/mastery#${m}`} className="flex justify-between text-sm hover:underline">
                      {IDX.mastery.find((x) => x.id === m)?.name}
                      <span className="text-xs text-muted">{st.replace(/_/g, " ")}</span>
                    </Link>
                  ))}
                </Section>
              </div>
            )}
            {p.roadmap.dsa.length > 0 && (
              <div className="mt-3">
                <Section title="DSA patterns">
                  <div className="flex flex-wrap gap-1">
                    {p.roadmap.dsa.map((c) => (
                      <Badge key={c}>{c}</Badge>
                    ))}
                  </div>
                </Section>
              </div>
            )}
            <div className="mt-3">
              <Section title="Resources">
                <ul className="space-y-1 text-sm">
                  {p.roadmap.resources.map((k) => (
                    <li key={k}>
                      <Link href={`/resources#${k}`} className="hover:underline">
                        {RESOURCES[k]?.name ?? k}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
            {(p.roadmap.gates?.length || p.roadmap.certs?.length) && (
              <div className="mt-3 flex flex-wrap gap-1">
                {p.roadmap.gates?.map((g) => (
                  <Link key={g} href={`/assessments#${g}`}>
                    <Badge>{g} gate</Badge>
                  </Link>
                ))}
                {p.roadmap.certs?.map((c) => (
                  <Badge key={c} tone="info">
                    {c}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
          <Card title="Prerequisites & next">
            {d.prereqs.length ? (
              <ul className="space-y-1 text-sm">
                {d.prereqs.map(({ x, st }) => (
                  <li key={x} className="flex justify-between gap-2">
                    <Link href={`/projects/${LAB_BY_ID.get(x)?.slug}`} className="hover:underline">
                      {LAB_BY_ID.get(x)?.name}
                    </Link>
                    <span className="text-xs text-muted">{PROJECT_STATUS_LABEL[st]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No project prerequisites.</p>
            )}
            {p.extends?.length ? (
              <p className="mt-2 text-xs text-muted">
                Extends roadmap project{p.extends.length > 1 ? "s" : ""}:{" "}
                {p.extends.map((x, i) => (
                  <span key={x}>
                    {i > 0 && ", "}
                    <Link href={`/projects/${x}`} className="text-info hover:underline">
                      {IDX.existingProjects.find((e) => e.id === x)?.name.split(" — ")[0]}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}
            {d.next.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                Unlocks:{" "}
                {d.next.map((q, i) => (
                  <span key={q.id}>
                    {i > 0 && ", "}
                    <Link href={`/projects/${q.slug}`} className="text-info hover:underline">
                      {q.name}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </Card>
          <ProjectReferences categories={p.categories} weeks={p.roadmap.weeks} />
          <Card title="Skills you'll prove">
            <div className="flex flex-wrap gap-1.5">
              {p.skills.map((x) => (
                <Badge key={x}>{x}</Badge>
              ))}
            </div>
          </Card>
          <Card title={`Quality checklist (${d.q.done}/${d.q.total})`}>
            <CheckList items={p.quality} scope="lab-quality" keyOf={(i) => labQualityKey(p.id, i)} />
          </Card>
          <Card title="GitHub-ready checklist">
            <Bullets items={p.github} />
          </Card>
          <Link href={`/tutor?prompt=sysdesign&topic=${encodeURIComponent(p.name)}`} className="block text-xs text-info hover:underline">
            Design review this project with Claude →
          </Link>
        </aside>
      </div>
    </>
  );
}

export function ExistingProjectDetail({ p, tasks }: { p: ExistingProject; tasks: { id: string; week: number; day: number; head: string }[] }) {
  const { hydrated } = useLS();
  const d = useDerived((s) => ({ prog: checklistProgress(s, existingProjectKeys(p.id)), extendedBy: LAB_PROJECTS.filter((x) => x.extends?.includes(p.id)).map((x) => ({ x, st: unlockInfo(s, x).state })) }), [p.id]);
  const done = useDerived((s) => new Set(tasks.filter((t) => s.tasks[t.id]?.status === "completed").map((t) => t.id)), [p.id]);
  if (!hydrated) return <Loading />;
  return (
    <>
      <PageHeader eyebrow={<Link href="/projects" className="hover:underline">Roadmap project · {p.tier} · weeks {p.weeks}</Link>} title={p.name} lead={p.objective}>
        <StatusControl id={p.id} />
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {p.tech.map((t) => (
          <Badge key={t}>{t}</Badge>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card title={`Progress (${d.prog.done}/${d.prog.total} checklist items)`}>
            <Progress value={d.prog.pct} />
          </Card>
          <Card title="Features">
            <CheckList items={p.features} scope="project" keyOf={(i) => `pj:${p.id}:f${i}`} />
          </Card>
          <Card title="Milestones">
            <CheckList items={p.milestones} scope="project" keyOf={(i) => `pj:${p.id}:m${i}`} />
          </Card>
          <Card title="GitHub-ready">
            <CheckList items={p.github} scope="project" keyOf={(i) => `pj:${p.id}:g${i}`} />
          </Card>
          <Card title="Evidence">
            <EvidenceForm id={p.id} fields={[{ field: "repo", label: "GitHub repository", required: false }, { field: "demo", label: "Live demo", required: false }, { field: "architecture", label: "Architecture diagram", required: false }, { field: "benchmark", label: "Benchmark report", required: false }, { field: "article", label: "Technical article", required: false }]} />
          </Card>
        </div>
        <aside className="space-y-4">
          <Card title="Skills">
            <Bullets items={p.skills} />
          </Card>
          <Card title="Deploy">
            <p className="text-sm">{p.deploy}</p>
            <p className="mt-2 text-xs text-muted">Sources: {p.sources}</p>
          </Card>
          <Card title={`Scheduled tasks (${done.size}/${tasks.length})`}>
            <ul className="max-h-80 space-y-1.5 overflow-y-auto text-sm scroll-thin">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link href={`/roadmap/${t.week}?task=${t.id}`} className={cx("hover:underline", done.has(t.id) && "text-muted line-through")}>
                    <span className="mr-1 font-mono text-xs text-faint">
                      W{t.week}D{t.day}
                    </span>
                    {t.head}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          {d.extendedBy.length > 0 && (
            <Card title="Take it further in the Lab">
              <ul className="space-y-1 text-sm">
                {d.extendedBy.map(({ x, st }) => (
                  <li key={x.id} className="flex justify-between gap-2">
                    <Link href={`/projects/${x.slug}`} className="hover:underline">
                      {x.name}
                    </Link>
                    <StateBadge state={st} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

// ───────────────────────────────────────────── picker & portfolio
export function PickerView() {
  const { hydrated, state, dispatch } = useLS();
  const [hours, setHours] = useState(25);
  const [cats, setCats] = useState<string[]>(state.prefs.interests ?? []);
  const recs = useDerived((s) => recommend(s, { limit: 6, maxHours: hours, interests: cats }), [hours, cats.join(",")]);
  if (!hydrated) return <Loading />;
  return (
    <>
      <PageHeader title="What should I build next?" lead="Recommendations weigh where you are in the roadmap, what you've mastered, projects you've finished, your interests and the time you have. Every suggestion explains itself." />
      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            Time available
            <select className={selectCls} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {[8, 15, 25, 40, 60, 100, 200].map((h) => (
                <option key={h} value={h}>
                  up to {h} h
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="ghost" onClick={() => dispatch("PREFERENCES_UPDATED", { patch: { interests: cats } })}>
            Save interests
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {LAB_CATEGORIES.map((c) => (
            <Button key={c} size="sm" variant={cats.includes(c) ? "primary" : "default"} onClick={() => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c])}>
              {c}
            </Button>
          ))}
        </div>
      </Card>
      {recs.length ? (
        <ol className="space-y-3">
          {recs.map((r, i) => (
            <li key={r.project.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted">#{i + 1}</span>
                <Link href={`/projects/${r.project.slug}`} className="font-medium hover:underline">
                  {r.project.name}
                </Link>
                <StateBadge state={r.unlock.state} />
                <Badge>T{r.project.tier}</Badge>
                <Badge>
                  {r.project.hours[0]}–{r.project.hours[1]} h
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">{r.project.objective}</p>
              <div className="mt-2 text-xs font-medium text-muted">Why this project</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
                {r.reasons.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <Empty title="Nothing fits those constraints yet">Try more hours, fewer interests, or keep going on the roadmap — projects unlock as their material is taught.</Empty>
      )}
    </>
  );
}

export function PortfolioView() {
  const { hydrated } = useLS();
  const d = useDerived((s) => {
    const st = portfolioStats(s);
    const all = [...LAB_PROJECTS.map((p) => ({ id: p.id, slug: p.slug, name: p.name, tier: `T${p.tier}` })), ...IDX.existingProjects.map((p) => ({ id: p.id, slug: p.id, name: p.name, tier: p.tier }))];
    const mine = all.map((p) => ({ ...p, status: projectStatus(s, p.id), ev: Object.values(s.projects[p.id]?.evidence ?? {}).filter((e) => e?.value).length })).filter((p) => p.status !== "idea");
    return { st, mine };
  });
  if (!hydrated) return <Loading />;
  const groups: ProjectStatus[] = ["portfolio_ready", "shipped", "completed", "in_progress", "paused", "ready", "planned"];
  return (
    <>
      <PageHeader title="Portfolio" lead="What you can show a hiring manager today: shipped work with evidence, not just finished tutorials." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Completed" value={d.st.completed} sub={`${d.st.roadmapProjectsDone} roadmap · ${d.st.completed - d.st.roadmapProjectsDone} Lab`} />
        <Stat label="Shipped / portfolio-ready" value={`${d.st.shipped} / ${d.st.portfolioReady}`} />
        <Stat label="Flagships completed" value={d.st.flagshipsCompleted} />
        <Stat label="Live demos" value={d.st.liveDemos} sub={`${d.st.benchmarks} benchmarks · ${d.st.writeups} write-ups`} />
      </div>
      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <Card title="By tier">
          {[1, 2, 3, 4].map((t) => {
            const x = d.st.byTier[t] ?? { total: 0, done: 0 };
            return (
              <div key={t} className="mb-2 grid grid-cols-[4rem_1fr_3rem] items-center gap-3 text-sm">
                <span>Tier {t}</span>
                <Progress value={(100 * x.done) / Math.max(1, x.total)} />
                <span className="text-right font-mono text-xs text-muted">
                  {x.done}/{x.total}
                </span>
              </div>
            );
          })}
        </Card>
        <Card title="Evidence">
          <ul className="grid grid-cols-2 gap-2 text-sm">
            <li>Architecture docs: {d.st.architectureDocs}</li>
            <li>Benchmarks: {d.st.benchmarks}</li>
            <li>Technical articles: {d.st.writeups}</li>
            <li>Postmortems: {d.st.postmortems}</li>
            <li>Live demos: {d.st.liveDemos}</li>
            <li>Started: {d.st.started}</li>
          </ul>
        </Card>
      </div>
      {d.mine.length ? (
        groups.map((g) => {
          const list = d.mine.filter((p) => p.status === g);
          if (!list.length) return null;
          return (
            <section key={g} className="mb-4">
              <h2 className="mb-2 text-sm font-semibold">
                {PROJECT_STATUS_LABEL[g]} ({list.length})
              </h2>
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {list.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                    <Link href={`/projects/${p.slug}`} className="min-w-0 flex-1 truncate hover:underline">
                      {p.name}
                    </Link>
                    <Badge>{p.tier}</Badge>
                    <span className="text-xs text-muted">{p.ev} evidence links</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      ) : (
        <Empty title="No projects started yet">
          <Link href="/projects/pick" className="text-info hover:underline">
            Get a recommendation
          </Link>
        </Empty>
      )}
    </>
  );
}

function ProjectReferences({ categories, weeks }: { categories: readonly string[]; weeks: number[] }) {
  const refs = curatedForProject(categories, weeks);
  if (!refs.length) return null;
  return (
    <Card title="Useful references" action={<Link href="/resources?tab=curated" className="text-xs text-muted hover:text-ink">More →</Link>}>
      <ul className="space-y-2 text-sm">
        {refs.map((c) => (
          <li key={c.key}>
            <a href={c.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
              {c.name}
            </a>
            <div className="line-clamp-2 text-xs text-muted">{c.use}</div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

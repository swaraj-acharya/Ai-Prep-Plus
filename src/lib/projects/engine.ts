import { LAB_BY_ID, LAB_PROJECTS, type LabCategory, type LabProject } from "@/data/projects/lab";
import { IDX } from "@/lib/roadmap/client-index";
import type { ProjectStatus } from "@/lib/state/events";
import type { UserState } from "@/lib/state/reducer";
import { currentDayIdx, existingProjectKeys, masteryStatus, weekProgress, checklistProgress } from "@/lib/state/selectors";

/**
 * Project Lab engine. Lab projects are a library beside the roadmap: they never create daily tasks.
 * "Locked" is advisory — every project can always be opened, explored and even started.
 */
export const DONE_STATUSES: ProjectStatus[] = ["completed", "shipped", "portfolio_ready"];
export const ACTIVE_STATUSES: ProjectStatus[] = ["in_progress", "paused", ...DONE_STATUSES];

export const labMilestoneKey = (id: string, i: number) => `lm:${id}:${i}`;
export const labQualityKey = (id: string, i: number) => `lq:${id}:${i}`;
export const labMilestoneKeys = (p: LabProject) => p.milestones.map((_, i) => labMilestoneKey(p.id, i));
export const labQualityKeys = (p: LabProject) => p.quality.map((_, i) => labQualityKey(p.id, i));

/** Status of a Lab or roadmap project: explicit status wins; checked work implies "in progress". */
export function projectStatus(s: UserState, id: string): ProjectStatus {
  const ps = s.projects[id];
  if (ps?.history?.length) return ps.status;
  const lab = LAB_BY_ID.get(id);
  const keys = lab ? [...labMilestoneKeys(lab), ...labQualityKeys(lab)] : existingProjectKeys(id);
  return keys.some((k) => s.checks[k]?.on) ? "in_progress" : "idea";
}
export const isDone = (s: UserState, id: string) => DONE_STATUSES.includes(projectStatus(s, id));

export function projectProgress(s: UserState, id: string) {
  const lab = LAB_BY_ID.get(id);
  if (!lab) return checklistProgress(s, existingProjectKeys(id));
  return checklistProgress(s, labMilestoneKeys(lab));
}

export type UnlockState = "locked" | "ready" | "recommended" | "in_progress" | "done";
export interface UnlockInfo {
  state: UnlockState;
  missingPrereqs: LabProject[];
  roadmapReady: boolean;
  currentWeek: number;
  /** Human-readable reasons the project is locked (empty when unlocked). */
  blockers: string[];
}

export function currentWeekOf(s: UserState): number {
  return IDX.days[currentDayIdx(s)]?.week ?? 1;
}

/** Roadmap readiness: you have reached the week that teaches the core material, or finished most of it early. */
export function roadmapReadyFor(s: UserState, p: LabProject, currentWeek = currentWeekOf(s)): boolean {
  return currentWeek > p.unlockWeek || weekProgress(s, p.unlockWeek).pct >= 60;
}

export function unlockInfo(s: UserState, p: LabProject, currentWeek = currentWeekOf(s)): UnlockInfo {
  const status = projectStatus(s, p.id);
  const missingPrereqs = p.prerequisites.map((id) => LAB_BY_ID.get(id)!).filter((q) => q && !isDone(s, q.id));
  const roadmapReady = roadmapReadyFor(s, p, currentWeek);
  const blockers: string[] = [];
  if (missingPrereqs.length) blockers.push(`Complete ${missingPrereqs.map((q) => q.name).join(", ")} first`);
  if (!roadmapReady) blockers.push(`Roadmap reaches this material in week ${p.unlockWeek} (${IDX.weeks[p.unlockWeek - 1]?.title}); you are in week ${currentWeek}`);
  let state: UnlockState = blockers.length ? "locked" : "ready";
  if (status === "in_progress" || status === "paused") state = "in_progress";
  if (DONE_STATUSES.includes(status)) state = "done";
  return { state, missingPrereqs, roadmapReady, currentWeek, blockers };
}

// ───────────────────────────────────────────── recommendations
const TIER_FOR_PHASE: Record<string, number[]> = {
  P0: [1], P1: [1], P2: [1, 2], P3: [2, 1], P4: [2, 3], P5: [3, 2], P6: [3, 4], P7: [4, 3], P8: [4, 3],
};

export interface Recommendation { project: LabProject; score: number; reasons: string[]; unlock: UnlockInfo }

export function recommend(s: UserState, opts: { limit?: number; interests?: string[]; maxHours?: number; categories?: string[] } = {}): Recommendation[] {
  const currentWeek = currentWeekOf(s);
  const phase = IDX.phaseOfWeek(currentWeek);
  const preferredTiers = TIER_FOR_PHASE[phase] ?? [1];
  const interests = new Set((opts.interests ?? s.prefs.interests ?? []).map((x) => x.toLowerCase()));
  const doneCats = new Set(LAB_PROJECTS.filter((p) => isDone(s, p.id)).flatMap((p) => p.categories));
  const out: Recommendation[] = [];

  for (const p of LAB_PROJECTS) {
    const unlock = unlockInfo(s, p, currentWeek);
    if (unlock.state === "done" || unlock.state === "locked") continue;
    if (opts.maxHours && p.hours[0] > opts.maxHours) continue;
    if (opts.categories?.length && !p.categories.some((c) => opts.categories!.includes(c))) continue;
    const reasons: string[] = [];
    let score = 0;

    if (unlock.state === "in_progress") { score += 60; reasons.push("You already started this project — finishing beats starting something new."); }

    const tierRank = preferredTiers.indexOf(p.tier);
    if (tierRank === 0) { score += 30; reasons.push(`${p.tierName} projects fit your current phase (${phase}).`); }
    else if (tierRank > 0) score += 15;
    else score -= 20;

    // Knowledge already covered by completed roadmap weeks.
    const learned = p.roadmap.weeks.filter((w) => w <= currentWeek && weekProgress(s, w).pct >= 60);
    if (learned.length) {
      score += Math.min(25, learned.length * 6);
      reasons.push(`You completed the roadmap material it builds on: ${learned.slice(-3).map((w) => `W${w} ${IDX.weeks[w - 1].title}`).join("; ")}.`);
    }
    const upcoming = p.roadmap.weeks.find((w) => w >= currentWeek && w <= currentWeek + 1);
    if (upcoming) { score += 15; reasons.push(`Week ${upcoming} (${IDX.weeks[upcoming - 1].title}) teaches exactly what it needs — build it alongside.`); }

    const mastered = p.roadmap.mastery.filter((m) => masteryStatus(s, m) === "mastered").map((m) => IDX.mastery.find((x) => x.id === m)?.name);
    if (mastered.length) { score += mastered.length * 5; reasons.push(`Mastery confirmed: ${mastered.join(", ")}.`); }

    const prereqsDone = p.prerequisites.filter((id) => isDone(s, id)).map((id) => LAB_BY_ID.get(id)!.name);
    if (prereqsDone.length) { score += 10; reasons.push(`Builds directly on your finished ${prereqsDone.join(" and ")}.`); }

    const ext = (p.extends ?? []).filter((id) => {
      const st = s.projects[id]?.status;
      return (st && st !== "idea") || existingProjectKeys(id).some((k) => s.checks[k]?.on);
    });
    if (ext.length) {
      score += 12;
      reasons.push(`Extends your roadmap project ${ext.map((id) => IDX.existingProjects.find((x) => x.id === id)?.name.split(" — ")[0]).join(", ")}.`);
    }

    const matched = p.categories.filter((c) => interests.has(c.toLowerCase()));
    if (matched.length) { score += 10 * matched.length; reasons.push(`Matches your interests: ${matched.join(", ")}.`); }

    const gaps = p.categories.filter((c) => !doneCats.has(c) && c !== "Startup" && c !== "Industry");
    if (gaps.length && doneCats.size) { score += 6; reasons.push(`Fills a portfolio gap: no finished ${gaps[0]} project yet.`); }

    if (p.tier === 4) reasons.push("Flagship: portfolio-defining, with startup analysis.");
    out.push({ project: p, score, reasons, unlock });
  }
  return out.sort((a, b) => b.score - a.score || a.project.tier - b.project.tier || a.project.hours[0] - b.project.hours[0]).slice(0, opts.limit ?? 5);
}

// ───────────────────────────────────────────── evidence & completion rules
export function missingEvidence(s: UserState, p: LabProject): string[] {
  const ev = s.projects[p.id]?.evidence ?? {};
  return p.evidence.filter((e) => e.required && !ev[e.field as keyof typeof ev]?.value?.trim()).map((e) => e.label);
}

/** What still blocks a status change. Advanced projects must carry evidence before they count as complete. */
export function statusBlockers(s: UserState, p: LabProject, target: ProjectStatus): string[] {
  if (!DONE_STATUSES.includes(target)) return [];
  const blockers: string[] = [];
  const ms = checklistProgress(s, labMilestoneKeys(p));
  if (ms.done < ms.total) blockers.push(`${ms.total - ms.done} milestone(s) unchecked`);
  if (p.tier >= 3 || target === "portfolio_ready") {
    const miss = missingEvidence(s, p);
    if (miss.length) blockers.push(`Missing evidence: ${miss.join(", ")}`);
  }
  if (target === "portfolio_ready") {
    const q = checklistProgress(s, labQualityKeys(p));
    if (q.done < q.total) blockers.push(`${q.total - q.done} quality checklist item(s) open`);
  }
  return blockers;
}

// ───────────────────────────────────────────── portfolio
export interface PortfolioStats {
  started: number; completed: number; shipped: number; portfolioReady: number; flagshipsCompleted: number;
  liveDemos: number; benchmarks: number; architectureDocs: number; writeups: number; postmortems: number;
  byTier: Record<number, { total: number; done: number }>;
  byCategory: Record<string, { total: number; done: number }>;
  roadmapProjectsDone: number;
}
export function portfolioStats(s: UserState): PortfolioStats {
  const st: PortfolioStats = {
    started: 0, completed: 0, shipped: 0, portfolioReady: 0, flagshipsCompleted: 0, liveDemos: 0, benchmarks: 0, architectureDocs: 0,
    writeups: 0, postmortems: 0, byTier: {}, byCategory: {}, roadmapProjectsDone: 0,
  };
  const all = [...LAB_PROJECTS.map((p) => ({ id: p.id, tier: p.tier, cats: p.categories as string[] })), ...IDX.existingProjects.map((p) => ({ id: p.id, tier: 0, cats: ["Roadmap"] }))];
  for (const p of all) {
    const status = projectStatus(s, p.id);
    const done = DONE_STATUSES.includes(status);
    if (status !== "idea" && status !== "planned" && status !== "ready") st.started++;
    if (done) st.completed++;
    if (status === "shipped" || status === "portfolio_ready") st.shipped++;
    if (status === "portfolio_ready") st.portfolioReady++;
    if (done && p.tier === 4) st.flagshipsCompleted++;
    if (done && p.tier === 0) st.roadmapProjectsDone++;
    const ev = s.projects[p.id]?.evidence ?? {};
    if (ev.demo?.value) st.liveDemos++;
    if (ev.benchmark?.value) st.benchmarks++;
    if (ev.architecture?.value) st.architectureDocs++;
    if (ev.article?.value) st.writeups++;
    if (ev.postmortem?.value) st.postmortems++;
    if (p.tier) {
      const t = (st.byTier[p.tier] ??= { total: 0, done: 0 });
      t.total++;
      if (done) t.done++;
    }
    for (const c of p.cats) {
      const x = (st.byCategory[c] ??= { total: 0, done: 0 });
      x.total++;
      if (done) x.done++;
    }
  }
  return st;
}

// ───────────────────────────────────────────── filters
export interface LabFilter { q?: string; tiers?: number[]; categories?: LabCategory[]; maxHours?: number; phase?: string; tech?: string; state?: UnlockState | "all"; prereqsMet?: boolean }
export function filterLab(s: UserState, f: LabFilter): LabProject[] {
  const q = f.q?.trim().toLowerCase();
  const currentWeek = currentWeekOf(s);
  return LAB_PROJECTS.filter((p) => {
    if (f.tiers?.length && !f.tiers.includes(p.tier)) return false;
    if (f.categories?.length && !f.categories.every((c) => p.categories.includes(c))) return false;
    if (f.maxHours && p.hours[0] > f.maxHours) return false;
    if (f.phase && IDX.phaseOfWeek(p.unlockWeek) !== f.phase) return false;
    if (f.tech && !p.tech.some((t) => t.toLowerCase().includes(f.tech!.toLowerCase()))) return false;
    if (f.prereqsMet && !p.prerequisites.every((id) => isDone(s, id))) return false;
    if (f.state && f.state !== "all" && unlockInfo(s, p, currentWeek).state !== f.state) return false;
    if (q) {
      const hay = [p.name, p.objective, p.problem, p.industry ?? "", ...p.categories, ...p.tech, ...p.skills].join(" ").toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}

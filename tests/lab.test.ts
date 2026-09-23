import { describe, expect, it } from "vitest";
import { LAB_BY_ID, LAB_CHAINS, LAB_PROJECTS } from "@/data/projects/lab";
import { IDX } from "@/lib/roadmap/client-index";
import { recommend, statusBlockers, unlockInfo, labMilestoneKey, projectStatus, portfolioStats } from "@/lib/projects/engine";
import { reduceEvents } from "@/lib/state/reducer";
import { ev } from "./helpers";

describe("Project Lab", () => {
  it("has at least 50 well-formed projects across four tiers", () => {
    expect(LAB_PROJECTS.length).toBeGreaterThanOrEqual(50);
    for (const t of [1, 2, 3, 4]) expect(LAB_PROJECTS.some((p) => p.tier === t)).toBe(true);
    const ids = new Set(LAB_PROJECTS.map((p) => p.id));
    expect(ids.size).toBe(LAB_PROJECTS.length);
    for (const p of LAB_PROJECTS) {
      for (const q of p.prerequisites) expect(ids.has(q)).toBe(true);
      for (const w of p.roadmap.weeks) expect(w >= 1 && w <= 52).toBe(true);
      for (const x of p.extends ?? []) expect(IDX.existingProjects.some((e) => e.id === x)).toBe(true);
      if (p.tier === 4) expect(p.startup).toBeTruthy();
      expect(p.milestones.length).toBeGreaterThan(0);
    }
    for (const c of LAB_CHAINS) for (const s of c.steps) expect(ids.has(s) || IDX.existingProjects.some((e) => e.id === s)).toBe(true);
  });
  it("locks by roadmap position and prerequisites, but never blocks exploring or starting", () => {
    const flagship = LAB_PROJECTS.find((p) => p.tier === 4)!;
    const fresh = reduceEvents([]);
    const u = unlockInfo(fresh, flagship);
    expect(u.state).toBe("locked");
    expect(u.blockers.length).toBeGreaterThan(0);
    const started = reduceEvents([ev("PROJECT_STATUS_SET", { projectId: flagship.id, status: "in_progress" })]);
    expect(unlockInfo(started, flagship).state).toBe("in_progress");
  });
  it("recommends unlocked projects with human-readable reasons", () => {
    const s = reduceEvents(IDX.tasks.filter((t) => t.week <= 20).map((t) => ev("TASK_COMPLETED", { taskId: t.id })));
    const recs = recommend(s, { limit: 3 });
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.unlock.state).not.toBe("locked");
      expect(r.reasons.length).toBeGreaterThan(0);
    }
  });
  it("requires milestones and evidence before an advanced project can be completed", () => {
    const p = LAB_PROJECTS.find((x) => x.tier === 3)!;
    let s = reduceEvents([]);
    expect(statusBlockers(s, p, "completed").length).toBe(2);
    s = reduceEvents([...p.milestones.map((_, i) => ev("CHECK_SET", { scope: "lab-milestone", key: labMilestoneKey(p.id, i), on: true })), ...p.evidence.filter((e) => e.required).map((e) => ev("PROJECT_EVIDENCE_SET", { projectId: p.id, field: e.field as "repo", value: "https://github.com/me/x" }))]);
    expect(statusBlockers(s, p, "completed")).toEqual([]);
    expect(statusBlockers(s, p, "portfolio_ready").length).toBe(1);
    expect(projectStatus(s, p.id)).toBe("in_progress");
    const done = reduceEvents([ev("PROJECT_STATUS_SET", { projectId: p.id, status: "shipped" })]);
    expect(portfolioStats(done).shipped).toBe(1);
    expect(LAB_BY_ID.get(p.id)).toBe(p);
  });
});

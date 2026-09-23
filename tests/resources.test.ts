import { describe, expect, it } from "vitest";
import roadmap from "@/data/generated/roadmap.json";
import { CURATED, LINK_FIXES } from "@/data/resources/curated";
import { LAB_PROJECTS } from "@/data/projects/lab";
import { curatedForProject, formatWeeks, parseWeeks, resourcesForWeek, withLinkFixes } from "@/lib/resources";
import type { Roadmap } from "@/lib/roadmap/types";

const R = roadmap as unknown as Roadmap;

describe("resources", () => {
  it("parses the library's week labels", () => {
    expect(parseWeeks("W21–W22")).toEqual([21, 22]);
    expect(parseWeeks("W7, W44")).toEqual([7, 44]);
    expect(parseWeeks("W50+")).toEqual([50, 51, 52]);
    expect(parseWeeks("W2–W3 + Side track/recall")).toEqual([2, 3]);
    expect(parseWeeks("Side track")).toEqual([]);
    expect(formatWeeks([19, 20, 21, 24, 26, 27])).toBe("W19–W21, W24, W26–W27");
  });
  it("keeps the 142 source resources intact and adds links only where the source had none", () => {
    expect(Object.keys(R.resources)).toHaveLength(142);
    const fixed = withLinkFixes(R.resources);
    for (const [k, r] of Object.entries(fixed)) expect(r.url, k).toMatch(/^https?:\/\//);
    for (const k of Object.keys(LINK_FIXES)) expect(R.resources[k].url).toBe("");
  });
  it("surfaces library resources on the weeks they belong to", () => {
    const w22 = R.weeks[21];
    const r = resourcesForWeek(22, w22.resources, R.resources);
    expect(r.library).toEqual(expect.arrayContaining(["grafana", "loki"]));
    expect(r.library.some((k) => w22.resources.includes(k))).toBe(false);
    expect(r.curated.map((c) => c.key)).toEqual(expect.arrayContaining(["x-evals-faq", "x-deepeval"]));
  });
  it("adds curated, verified resources that do not duplicate the library", () => {
    expect(CURATED.length).toBeGreaterThanOrEqual(60);
    const urls = new Set(Object.values(R.resources).map((r) => r.url.replace(/\/$/, "")));
    for (const c of CURATED) {
      expect(c.key.startsWith("x-")).toBe(true);
      expect(urls.has(c.url.replace(/\/$/, "")), c.key).toBe(false);
      if (c.type === "GitHub repo") expect(c.lastCommit).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // every roadmap week has at least one resource (scheduled, library or curated)
    for (const w of R.weeks) {
      const r = resourcesForWeek(w.n, w.resources, R.resources);
      expect(r.scheduled.length + r.library.length + r.curated.length).toBeGreaterThan(0);
    }
  });
  it("recommends relevant references for Lab projects", () => {
    const rag = LAB_PROJECTS.find((p) => p.categories.includes("RAG"))!;
    const refs = curatedForProject(rag.categories, rag.roadmap.weeks);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.every((c) => (c.categories ?? []).some((x) => rag.categories.includes(x as never)))).toBe(true);
    expect(refs.some((c) => c.categories?.includes("RAG"))).toBe(true);
  });
});

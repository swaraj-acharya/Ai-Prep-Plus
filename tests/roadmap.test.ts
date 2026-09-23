import { describe, expect, it } from "vitest";
import roadmap from "@/data/generated/roadmap.json";
import audit from "@/data/generated/audit.json";
import { IDX } from "@/lib/roadmap/client-index";
import { TASK_ID_RE } from "@/lib/state/events";
import { PROMPTS } from "@/lib/roadmap/server";
import type { Roadmap } from "@/lib/roadmap/types";

const R = roadmap as unknown as Roadmap;

describe("extracted roadmap", () => {
  it("preserves every counted element of the source", () => {
    expect(R.weeks).toHaveLength(52);
    expect(R.days).toHaveLength(364);
    expect(R.tasks).toHaveLength(1481);
    expect(R.dsaProblems).toHaveLength(175);
    expect(Object.keys(R.resources)).toHaveLength(142);
    expect(R.existingProjects).toHaveLength(15);
    expect(R.mastery).toHaveLength(20);
    expect(R.mastery.reduce((a, m) => a + m.items.length, 0)).toBe(109);
    expect(R.assessments).toHaveLength(7);
    expect(PROMPTS).toHaveLength(8);
    expect(R.sideTracks.map((t) => t.id).sort()).toEqual(["chain", "cyber", "mern"]);
  });
  it("contains no VLSI content", () => {
    const text = JSON.stringify(R).toLowerCase();
    for (const w of ["vlsi", "verilog", "systemverilog", "uvm", "asic", "fpga", "rtl design", "tapeout", "synopsys"]) expect(new RegExp("\\b" + w + "\\b").test(text), w).toBe(false);
    expect(JSON.stringify(audit.removed)).toMatch(/phases/);
  });
  it("uses stable, well-formed task ids with a consistent client index", () => {
    const ids = new Set(R.tasks.map((t) => t.id));
    expect(ids.size).toBe(R.tasks.length);
    for (const t of R.tasks) expect(t.id).toMatch(TASK_ID_RE);
    expect(IDX.tasks).toHaveLength(R.tasks.length);
    for (const d of R.days) for (const id of d.taskIds) expect(ids.has(id)).toBe(true);
    const orders = R.tasks.map((t) => t.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });
  it("links every DSA problem and project task to real tasks", () => {
    for (const p of R.dsaProblems) for (const t of p.tasks) expect(IDX.byId.has(t.taskId)).toBe(true);
    for (const p of R.existingProjects) for (const id of p.scheduledTaskIds) expect(IDX.byId.has(id)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { IDX } from "@/lib/roadmap/client-index";
import { buildHistory, matchesFilter } from "@/lib/history";
import { reduceEvents } from "@/lib/state/reducer";
import { ev } from "./helpers";

describe("history", () => {
  it("lists every active day newest first with what was done", () => {
    const pid = IDX.dsa[0].id;
    const [t1, t2, t3] = IDX.dayTasks(0).map((t) => t.id);
    const s = reduceEvents([
      ev("TASK_COMPLETED", { taskId: t1 }, "2026-03-01T10:00:00Z"),
      ev("TASK_COMPLETED", { taskId: t2 }, "2026-03-01T11:00:00Z"),
      ev("TASK_COMPLETED", { taskId: t3 }, "2026-03-01T12:00:00Z"),
      ev("DSA_ATTEMPTED", { problemId: pid, mode: "first", outcome: "unsolved", minutes: 30 }, "2026-03-01T13:00:00Z"),
      ev("DSA_ATTEMPTED", { problemId: pid, mode: "first", outcome: "solved", minutes: 25 }, "2026-03-02T09:00:00Z"),
      ev("DSA_ATTEMPTED", { problemId: pid, mode: "revision", outcome: "unsolved", minutes: 20 }, "2026-03-03T09:00:00Z"),
      ev("ASSESSMENT_PASSED", { phase: IDX.gates[0].phase }, "2026-03-03T10:00:00Z"),
    ]);
    const h = buildHistory(s);
    expect(h.map((d) => d.day)).toEqual(["2026-03-03", "2026-03-02", "2026-03-01"]);
    expect(h[2]).toMatchObject({ tasks: 3, units: 3, goal: 3, goalMet: true });
    expect(h[2].entries.map((e) => e.kind)).toEqual(["task", "task", "task", "dsa_attempt"]);
    expect(h[1].entries.map((e) => e.kind)).toEqual(["dsa_solved"]);
    expect(h[0].entries.map((e) => e.kind).sort()).toEqual(["dsa_forgot", "gate"]);
    expect(matchesFilter("dsa_forgot", "revisions")).toBe(true);
    expect(matchesFilter("gate", "milestones")).toBe(true);
    expect(matchesFilter("task", "dsa")).toBe(false);
  });
  it("tells the truth: un-ticking a task removes it from its day", () => {
    const id = IDX.tasks[0].id;
    const s = reduceEvents([ev("TASK_COMPLETED", { taskId: id }, "2026-03-01T10:00:00Z"), ev("TASK_UNCOMPLETED", { taskId: id }, "2026-03-01T11:00:00Z")]);
    expect(buildHistory(s)).toEqual([]);
  });
});

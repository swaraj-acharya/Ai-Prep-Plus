import { describe, expect, it } from "vitest";
import { IDX } from "@/lib/roadmap/client-index";
import { allProblemStatuses, dsaSummary, revisionQueue } from "@/lib/dsa/engine";
import { reduceEvents } from "@/lib/state/reducer";
import { ev } from "./helpers";

const pid = IDX.dsa[0].id;
const status = (events: ReturnType<typeof ev>[], today: string) => allProblemStatuses(reduceEvents(events), [pid], today).get(pid)!;

describe("DSA revision engine", () => {
  it("schedules revisions from the first solve and never completes them automatically", () => {
    const first = ev("DSA_ATTEMPTED", { problemId: pid, mode: "first", outcome: "solved", minutes: 20 }, "2026-02-01T10:00:00Z");
    const st = status([first], "2026-02-10");
    expect(st.solved).toBe(true);
    expect(st.firstPassSolved).toBe(true);
    expect(st.schedule[0]).toMatchObject({ intervalDays: 1, dueDate: "2026-02-02" });
    expect(st.retained).toBe(false);
    expect(st.nextDue).toBe("2026-02-02");
    expect(st.revisionsCompleted).toBe(0);
    expect(st.dueInDays).toBeLessThan(0);
  });
  it("advances only on a solved attempt on/after the due date and resets on failure", () => {
    const events = [
      ev("DSA_ATTEMPTED", { problemId: pid, mode: "first", outcome: "solved", minutes: 20 }, "2026-02-01T10:00:00Z"),
      ev("DSA_ATTEMPTED", { problemId: pid, mode: "revision", outcome: "solved", minutes: 12 }, "2026-02-02T10:00:00Z"),
    ];
    const st = status(events, "2026-02-03");
    expect(st.revisionsCompleted).toBe(1);
    expect(st.nextDue).toBe("2026-02-09");
    expect(st.coldSolved).toBe(true);
    const failed = status([...events, ev("DSA_ATTEMPTED", { problemId: pid, mode: "revision", outcome: "unsolved", minutes: 30, mistakeType: "pattern" }, "2026-02-09T10:00:00Z")], "2026-02-09");
    expect(failed.stage).toBe(0);
    expect(failed.mistakes.pattern).toBe(1);
  });
  it("respects configurable intervals", () => {
    const events = [ev("PREFERENCES_UPDATED", { patch: { revisionIntervals: [2, 5] } }), ev("DSA_ATTEMPTED", { problemId: pid, mode: "first", outcome: "solved", minutes: 20 }, "2026-02-01T10:00:00Z")];
    const st = status(events, "2026-02-01");
    expect(st.schedule[0].intervalDays).toBe(2);
    expect(st.nextDue).toBe("2026-02-03");
  });
  it("summarises and queues due work", () => {
    const s = reduceEvents([ev("DSA_ATTEMPTED", { problemId: pid, mode: "first", outcome: "solved", minutes: 20 }, "2026-02-01T10:00:00Z")]);
    const statuses = allProblemStatuses(s, IDX.dsa.map((d) => d.id), "2026-02-05");
    expect(dsaSummary(statuses.values()).solved).toBe(1);
    expect(revisionQueue(statuses.values(), 0).map((x) => x.problemId)).toEqual([pid]);
  });
});

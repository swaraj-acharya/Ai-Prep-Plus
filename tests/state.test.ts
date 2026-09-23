import { describe, expect, it } from "vitest";
import { IDX } from "@/lib/roadmap/client-index";
import { localDateOf } from "@/lib/dates";
import { reduceEvents } from "@/lib/state/reducer";
import { currentDayIdx, currentTask, dayProgress, gateStatus, masteryStatus, overallProgress, statusOf, streakInfo, computeStreak } from "@/lib/state/selectors";
import { LearningEvent } from "@/lib/state/events";
import { ev } from "./helpers";

const day0 = IDX.dayTasks(0).map((t) => t.id);

describe("reducer", () => {
  it("is order-independent and idempotent", () => {
    const events = [
      ev("TASK_COMPLETED", { taskId: day0[0] }),
      ev("TASK_UNCOMPLETED", { taskId: day0[0] }),
      ev("TASK_COMPLETED", { taskId: day0[0] }),
      ev("TASK_SKIPPED", { taskId: day0[1] }),
      ev("NOTE_SAVED", { key: "task:x", text: "a" }),
      ev("NOTE_SAVED", { key: "task:x", text: "b" }),
      ev("CHECK_SET", { scope: "mastery", key: "ms:m-python:0", on: true }),
    ];
    const a = reduceEvents(events);
    const b = reduceEvents([...events].reverse());
    const c = reduceEvents([...events, ...events]);
    for (const s of [b, c]) {
      expect(s.tasks).toEqual(a.tasks);
      expect(s.notes).toEqual(a.notes);
      expect(s.checks).toEqual(a.checks);
    }
    expect(statusOf(a, day0[0])).toBe("completed");
    expect(a.notes["task:x"].text).toBe("b");
  });
  it("rejects malformed events at the boundary", () => {
    expect(LearningEvent.safeParse({ id: "x", type: "TASK_COMPLETED", payload: { taskId: "w1d1t1" } }).success).toBe(false);
    expect(() => ev("TASK_COMPLETED", { taskId: "not-a-task" })).toThrow();
  });
});

describe("position", () => {
  it("is the first day with an unresolved task", () => {
    expect(currentDayIdx(reduceEvents([]))).toBe(0);
    const s = reduceEvents(day0.map((id, i) => (i % 2 ? ev("TASK_SKIPPED", { taskId: id }) : ev("TASK_COMPLETED", { taskId: id }))));
    expect(currentDayIdx(s)).toBe(1);
    expect(currentTask(s)!.id).toBe(IDX.dayTasks(1)[0].id);
  });
  it("deferred tasks do not block the position but stay visible", () => {
    const s = reduceEvents(day0.map((id) => ev("TASK_DEFERRED", { taskId: id })));
    expect(currentDayIdx(s)).toBe(1);
    expect(dayProgress(s, 0).done).toBe(0);
  });
});

describe("streaks & time zones", () => {
  it("assigns work to the local calendar day of the configured zone", () => {
    expect(localDateOf("2026-01-01T20:00:00Z", "Asia/Kolkata")).toBe("2026-01-02");
    expect(localDateOf("2026-01-02T03:00:00Z", "America/Los_Angeles")).toBe("2026-01-01");
  });
  it("needs ≥ threshold units per local day", () => {
    const ids = IDX.tasks.slice(0, 6).map((t) => t.id);
    // 23:30 IST on Jan 1 and 00:30 IST on Jan 2 fall on different local days even though they are an hour apart.
    const s = reduceEvents([
      ev("TASK_COMPLETED", { taskId: ids[0] }, "2026-01-01T17:50:00Z", "Asia/Kolkata"),
      ev("TASK_COMPLETED", { taskId: ids[1] }, "2026-01-01T17:55:00Z", "Asia/Kolkata"),
      ev("TASK_COMPLETED", { taskId: ids[2] }, "2026-01-01T18:00:00Z", "Asia/Kolkata"),
      ev("TASK_COMPLETED", { taskId: ids[3] }, "2026-01-01T19:00:00Z", "Asia/Kolkata"),
      ev("TASK_COMPLETED", { taskId: ids[4] }, "2026-01-01T19:05:00Z", "Asia/Kolkata"),
      ev("TASK_COMPLETED", { taskId: ids[5] }, "2026-01-01T19:10:00Z", "Asia/Kolkata"),
    ]);
    const st = streakInfo(s, "2026-01-02");
    expect(st.activeDates).toEqual(["2026-01-01", "2026-01-02"]);
    expect(st.current).toBe(2);
    const low = reduceEvents([ev("TASK_COMPLETED", { taskId: ids[0] }, "2026-01-05T10:00:00Z")]);
    expect(streakInfo(low, "2026-01-05").current).toBe(0);
  });
  it("keeps today's streak alive until the day ends and breaks after a missed day", () => {
    expect(computeStreak(["2026-01-01", "2026-01-02"], "2026-01-03").current).toBe(2);
    expect(computeStreak(["2026-01-01", "2026-01-02"], "2026-01-04").current).toBe(0);
    expect(computeStreak(["2026-01-01", "2026-01-02", "2026-01-05"], "2026-01-05").longest).toBe(2);
  });
});

describe("mastery and gates are never automatic", () => {
  it("finishing a phase does not pass its gate or confirm mastery", () => {
    const phase = IDX.gates[0].phase;
    const s = reduceEvents(IDX.phaseTasks(phase).map((t) => ev("TASK_COMPLETED", { taskId: t.id })));
    expect(gateStatus(s, phase)).toBe("not_started");
    for (const m of IDX.mastery.filter((x) => x.week <= 2)) expect(masteryStatus(s, m.id)).not.toBe("mastered");
    expect(overallProgress(s).done).toBe(IDX.phaseTasks(phase).length);
  });
  it("mastery becomes ready only when every item is checked, and mastered only when confirmed", () => {
    const m = IDX.mastery[0];
    const checks = Array.from({ length: m.items }, (_, i) => ev("CHECK_SET", { scope: "mastery", key: `ms:${m.id}:${i}`, on: true }));
    expect(masteryStatus(reduceEvents(checks.slice(1)), m.id)).toBe("in_progress");
    expect(masteryStatus(reduceEvents(checks), m.id)).toBe("ready_to_confirm");
    expect(masteryStatus(reduceEvents([...checks, ev("MASTERY_CONFIRMED", { masteryId: m.id })]), m.id)).toBe("mastered");
  });
});

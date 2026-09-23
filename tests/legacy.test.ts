import { describe, expect, it } from "vitest";
import { IDX } from "@/lib/roadmap/client-index";
import { exportBackup, importAny, importLegacy } from "@/lib/state/legacy";
import { reduceEvents } from "@/lib/state/reducer";
import { gateStatus, statusOf, totalStudyMinutes } from "@/lib/state/selectors";
import { ev } from "./helpers";

describe("importers", () => {
  it("maps the original Learning OS state and drops VLSI", () => {
    const t = IDX.tasks[0].id;
    const g = IDX.gates.find((x) => x.criteria > 1)!;
    const legacy = {
      done: { [t]: true, "w99d1t1": true },
      doneAt: { [t]: "2026-01-05" },
      checks: { "vl:rtl:0": true, [`as:${g.phase}:pc0`]: true, "ms:m-python:0": true },
      notes: { "3": { learned: "recursion", struggled: "" }, [`weak:${g.phase}`]: "graphs" },
      timer: { byDate: { "2026-01-05": 45 } },
      prefs: { start: "2026-01-01", mustOnly: true },
    };
    const r = importLegacy(legacy, "UTC");
    expect(r.summary).toMatchObject({ tasks: 1, vlsiChecksRemoved: 1, gatesPassed: 0, notes: 2, studyDays: 1 });
    expect(r.dropped.some((d) => d.key === "w99d1t1")).toBe(true);
    const s = reduceEvents(r.events);
    expect(statusOf(s, t)).toBe("completed");
    expect(s.tasks[t].completedDate).toBe("2026-01-05");
    expect(gateStatus(s, g.phase)).not.toBe("passed");
    expect(s.notes["review:W3:learned"].text).toBe("recursion");
    expect(totalStudyMinutes(s)).toBe(45);
    expect(s.prefs.mustOnly).toBe(true);
    expect(Object.keys(s.checks).some((k) => k.startsWith("vl:"))).toBe(false);
  });
  it("passes a gate only when every criterion was checked", () => {
    const g = IDX.gates[0];
    const checks = Object.fromEntries(Array.from({ length: g.criteria }, (_, i) => [`as:${g.phase}:pc${i}`, true]));
    const s = reduceEvents(importLegacy({ checks }, "UTC").events);
    expect(gateStatus(s, g.phase)).toBe("passed");
  });
  it("round-trips backups idempotently", () => {
    const events = [ev("TASK_COMPLETED", { taskId: IDX.tasks[0].id }), ev("NOTE_SAVED", { key: "k", text: "v" })];
    const file = JSON.parse(JSON.stringify(exportBackup(events)));
    const r = importAny(file, "UTC");
    expect(r.kind).toBe("backup");
    expect(r.events.map((e) => e.id)).toEqual(events.map((e) => e.id));
    expect(() => importAny({ nope: 1 }, "UTC")).toThrow();
  });
});

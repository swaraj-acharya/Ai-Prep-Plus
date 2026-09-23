/**
 * Acceptance flow over the domain layer (the UI dispatches exactly these events):
 * guest learns offline → position advances → DSA + revision → mastery → gate → Lab project →
 * sign-in merge of two devices → history reconstruction → GitHub publish (no-op on repeat).
 */
import { describe, expect, it } from "vitest";
import { IDX } from "@/lib/roadmap/client-index";
import { reduceEvents } from "@/lib/state/reducer";
import { currentDayIdx, dailyActivity, gateStatus, masteryStatus, overallProgress, streakInfo } from "@/lib/state/selectors";
import { allProblemStatuses } from "@/lib/dsa/engine";
import { recommend, unlockInfo } from "@/lib/projects/engine";
import { pushProgress } from "@/lib/github/sync";
import { buildHistory } from "@/lib/history";
import { scoreboard } from "@/lib/state/scoreboard";
import { ev, FakeGitHub } from "./helpers";
import { LAB_PROJECTS } from "@/data/projects/lab";

describe("acceptance workflow", () => {
  it("runs the core learning loop end to end", async () => {
    const deviceA = IDX.dayTasks(0).map((t, i) => ev("TASK_COMPLETED", { taskId: t.id }, `2026-03-02T0${i}:30:00Z`, "Asia/Kolkata"));
    const s1 = reduceEvents(deviceA);
    expect(currentDayIdx(s1)).toBe(1);
    expect(streakInfo(s1, "2026-03-02").todayActive).toBe(true);

    const problem = IDX.tasks.find((t) => t.problemIds.length)!.problemIds[0];
    const deviceB = [
      ev("DSA_ATTEMPTED", { problemId: problem, mode: "first", outcome: "solved", minutes: 22 }, "2026-03-02T12:00:00Z", "Asia/Kolkata"),
      ev("DSA_ATTEMPTED", { problemId: problem, mode: "revision", outcome: "solved", minutes: 9 }, "2026-03-03T12:00:00Z", "Asia/Kolkata"),
      ev("TASK_DEFERRED", { taskId: IDX.dayTasks(1)[0].id }, "2026-03-03T12:30:00Z", "Asia/Kolkata"),
    ];
    // Merge from two devices in either order → identical state.
    const merged = reduceEvents([...deviceA, ...deviceB]);
    const mergedRev = reduceEvents([...deviceB, ...deviceA]);
    expect(merged.tasks).toEqual(mergedRev.tasks);
    expect(allProblemStatuses(merged, [problem], "2026-03-04").get(problem)!.revisionsCompleted).toBe(1);

    const m = IDX.mastery[0];
    const mastery = [...Array.from({ length: m.items }, (_, i) => ev("CHECK_SET", { scope: "mastery", key: `ms:${m.id}:${i}`, on: true })), ev("MASTERY_CONFIRMED", { masteryId: m.id })];
    const gate = IDX.gates[0];
    const gateEv = [...Array.from({ length: gate.criteria }, (_, i) => ev("CHECK_SET", { scope: "gate", key: `as:${gate.phase}:pc${i}`, on: true })), ev("ASSESSMENT_PASSED", { phase: gate.phase })];
    const all = [...deviceA, ...deviceB, ...mastery, ...gateEv];
    const s = reduceEvents(all);
    expect(masteryStatus(s, m.id)).toBe("mastered");
    expect(gateStatus(s, gate.phase)).toBe("passed");

    // Lab projects early in the year are locked by roadmap position, but can still be started.
    const lab = LAB_PROJECTS[0];
    expect(recommend(s, { limit: 3 }).every((r) => r.unlock.state !== "locked")).toBe(true);
    expect(unlockInfo(s, lab).state).toBe("locked");
    const started = reduceEvents([...all, ev("PROJECT_STATUS_SET", { projectId: lab.id, status: "in_progress" })]);
    expect(unlockInfo(started, lab).state).toBe("in_progress");

    // History: reconstruct the end of 2026-03-02 (IST) from events alone.
    const asOf = reduceEvents(all.filter((e) => e.localDate <= "2026-03-02"));
    expect(overallProgress(asOf).done).toBe(IDX.dayTasks(0).length);
    expect(dailyActivity(s)["2026-03-03"].revisionsCompleted).toBe(1);
    expect(scoreboard(s, "2026-03-04").find((a) => a.id === "dsa")!.pct).toBeGreaterThan(0);

    // History lists the days, newest first.
    expect(buildHistory(s)[0].day >= buildHistory(s).at(-1)!.day).toBe(true);

    // Push progress now: everything goes up as one commit; a second push with nothing new commits nothing.
    const gh = new FakeGitHub("me", "prepboard", { "package.json": "{}\n" });
    const r1 = await pushProgress({ api: gh, owner: "me", repo: "prepboard", branch: "main", dir: "progress", incoming: all, now: new Date("2026-03-04T10:00:00Z") });
    expect(r1.status).toBe("committed");
    expect(r1.message).toContain(`passed ${gate.phase} gate`);
    expect(r1.message).toContain(`mastered ${IDX.mastery[0].name}`);
    expect(gh.log()).toHaveLength(2);
    const r2 = await pushProgress({ api: gh, owner: "me", repo: "prepboard", branch: "main", dir: "progress", incoming: all });
    expect(r2.status).toBe("noop");
  });
});

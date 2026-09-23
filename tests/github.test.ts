import { describe, expect, it } from "vitest";
import { IDX } from "@/lib/roadmap/client-index";
import { GitHubError, gitBlobSha, validateRepoTarget } from "@/lib/github/api";
import { serializeJournal } from "@/lib/github/serialize";
import { commitMessage, describeDays, parseEvents, pushProgress, serializeEvents } from "@/lib/github/sync";
import { reduceEvents } from "@/lib/state/reducer";
import type { LearningEvent } from "@/lib/state/events";
import { ev, FakeGitHub } from "./helpers";

const dayEvents = (idx: number, date: string) => IDX.dayTasks(idx).map((t, i) => ev("TASK_COMPLETED", { taskId: t.id }, `${date}T1${i % 10}:00:00Z`));
const push = (api: FakeGitHub, incoming: LearningEvent[], now = "2026-03-03T09:00:00Z") =>
  pushProgress({ api, owner: api.owner, repo: api.repo, branch: "main", dir: "progress", incoming, tz: "UTC", now: new Date(now) });

describe("progress files", () => {
  it("live under progress/ and read like the reference PrepBoard", () => {
    const s = reduceEvents(dayEvents(0, "2026-03-02"));
    const { files } = serializeJournal(s, { dir: "progress", today: "2026-03-03" });
    for (const p of Object.keys(files)) expect(p.startsWith("progress/")).toBe(true);
    expect(files["progress/README.md"]).toContain("## Last 14 days");
    expect(files["progress/README.md"]).toContain("Updated 2026-03-03");
    expect(files["progress/README.md"]).toMatch(/Current streak: \*\*1 day\*\*/);
    expect(files["progress/HISTORY.md"]).toContain("Monday, 2 March 2026");
    expect(files["progress/HISTORY.md"]).toContain("| Completed | `W01D1`");
    expect(files).toHaveProperty(["progress/daily/2026/2026-03-02.md"]);
  });
  it("stores the event log one event per line and round-trips it", () => {
    const events = dayEvents(0, "2026-03-02");
    const text = serializeEvents([...events].reverse());
    expect(text.split("\n").length).toBe(events.length + 3);
    expect(parseEvents(text).events.map((e) => e.id)).toEqual(events.map((e) => e.id));
    expect(() => parseEvents("{not json")).toThrow(GitHubError);
  });
  it("hashes blobs like git and validates configuration", () => {
    expect(gitBlobSha("hello\n")).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
    expect(validateRepoTarget("me", "learning-journal")).toBeNull();
    expect(validateRepoTarget("me", "../etc")).not.toBeNull();
    expect(validateRepoTarget("me", "x", "main", "../up")).not.toBeNull();
  });
});

describe("push progress now", () => {
  it("pushes everything since the last push as ONE commit, and nothing when nothing is new", async () => {
    const api = new FakeGitHub("me", "prepboard", { "package.json": "{}\n", "src/app.ts": "x\n" });
    const pid = IDX.dsa[0].id;
    const gate = IDX.gates[0].phase;
    const batch = [...dayEvents(0, "2026-03-02"), ev("DSA_ATTEMPTED", { problemId: pid, mode: "first", outcome: "solved", minutes: 18 }, "2026-03-02T15:00:00Z"), ev("ASSESSMENT_PASSED", { phase: gate }, "2026-03-02T16:00:00Z")];
    const r = await push(api, batch);
    expect(r.status).toBe("committed");
    expect(api.log()).toEqual(["seed", `Completed W01D1; solved ${IDX.dsa[0].name}; passed ${gate} gate`]);
    expect(r.url).toMatch(/^https:\/\/github\.com\/me\/prepboard\/commit\//);
    expect(parseEvents(api.file("progress/events.json")!).events).toHaveLength(batch.length);
    expect(api.file("src/app.ts")).toBe("x\n"); // app files untouched
    const again = await push(api, batch);
    expect(again).toMatchObject({ status: "noop", pushed: 0 });
    expect(api.log()).toHaveLength(2);
  });
  it("merges two devices: nothing is overwritten", async () => {
    const api = new FakeGitHub("me", "prepboard", { "README.md": "app\n" });
    const laptop = dayEvents(0, "2026-03-02");
    const phone = [ev("DSA_ATTEMPTED", { problemId: IDX.dsa[1].id, mode: "first", outcome: "solved", minutes: 20 }, "2026-03-02T20:00:00Z")];
    await push(api, laptop);
    const r = await push(api, phone); // the phone never saw the laptop's events
    expect(r.status).toBe("committed");
    const stored = parseEvents(api.file("progress/events.json")!).events.map((e) => e.id).sort();
    expect(stored).toEqual([...laptop, ...phone].map((e) => e.id).sort());
  });
  it("retries on top of a push that landed in the meantime", async () => {
    const api = new FakeGitHub("me", "prepboard", { "README.md": "app\n" });
    const other = dayEvents(1, "2026-03-03");
    api.raceOnce = () => {
      const tree = api.trees.get(api.commits.get(api.refs.get("main")!)!.tree)!;
      const content = serializeEvents(other);
      const t = `t-race`;
      api.blobs.set(gitBlobSha(content), content);
      api.trees.set(t, { ...tree, "progress/events.json": gitBlobSha(content) });
      api.commits.set("c-race", { tree: t, parents: [api.refs.get("main")!], message: "other device" });
      api.refs.set("main", "c-race");
    };
    const mine = dayEvents(0, "2026-03-02");
    const r = await push(api, mine);
    expect(r.status).toBe("committed");
    expect(api.log()).toEqual(["seed", "other device", "Completed W01D1"]);
    expect(parseEvents(api.file("progress/events.json")!).events).toHaveLength(mine.length + other.length);
  });
  it("initialises an empty repository and surfaces GitHub errors without writing", async () => {
    const empty = new FakeGitHub();
    const r = await push(empty, dayEvents(0, "2026-03-02"));
    expect(empty.log()).toEqual(["Start learning progress", "Completed W01D1"]);
    expect(r.status).toBe("committed");
    const broken = new FakeGitHub("me", "x", { "a.txt": "a\n" });
    broken.failNext = new GitHubError("auth", "bad token", 401);
    await expect(push(broken, dayEvents(0, "2026-03-02"))).rejects.toMatchObject({ kind: "auth" });
    expect(broken.writes).toBe(0);
  });
  it("writes honest, specific commit messages", () => {
    const events = [...dayEvents(0, "2026-03-02"), ...dayEvents(1, "2026-03-02")];
    expect(commitMessage(events, reduceEvents(events))).toBe("Completed W01D1, W01D2");
    const one = [ev("TASK_COMPLETED", { taskId: IDX.dayTasks(2)[0].id })];
    expect(commitMessage(one, reduceEvents(one))).toMatch(/^Completed W01D3 task: /);
    const note = [ev("NOTE_SAVED", { key: "review:W1:learned", text: "x" })];
    expect(commitMessage(note, reduceEvents(note))).toBe("Wrote W1 reflection");
    expect(describeDays(["W14D1", "W14D2", "W14D3", "W14D4", "W14D5"])).toBe("W14D1–W14D5 (5 days)");
  });
});

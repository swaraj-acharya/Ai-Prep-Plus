import { ROADMAP } from "@/lib/roadmap/server";
import { LAB_BY_ID } from "@/data/projects/lab";
import { LearningEvent } from "@/lib/state/events";
import { reduceEvents, type UserState } from "@/lib/state/reducer";
import { isValidTimeZone, localDateOf } from "@/lib/dates";
import { gitBlobSha, GitHubError, type GitHubApi, type TreeEntryInput } from "./api";
import { dayKey, serializeJournal } from "./serialize";

/**
 * "Push progress now": everything recorded since the last push goes up together as ONE commit.
 *
 *   1. read <dir>/events.json at the branch head (the complete learning log)
 *   2. merge it with the events this device sends (a set union by event id — events are immutable,
 *      so two devices can never conflict)
 *   3. if nothing is new → no commit at all
 *   4. otherwise write events.json + every readable file that changed, in a single commit whose
 *      message says what you did ("Completed W14D3; solved Two Sum; passed P3 gate")
 *   5. fast-forward the branch; if another device pushed in the meantime, redo it on top (3 tries)
 *
 * Commits are dated when you push. Nothing is backdated and files outside <dir>/ are never touched.
 */
export const EVENTS_FILE = "events.json";

const byTime = (a: LearningEvent, b: LearningEvent) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : a.id < b.id ? -1 : 1);

/** One event per line: valid JSON, and git diffs show exactly what was added. */
export function serializeEvents(events: LearningEvent[]): string {
  const sorted = [...events].sort(byTime);
  return sorted.length ? `[\n${sorted.map((e) => JSON.stringify(e)).join(",\n")}\n]\n` : "[]\n";
}
export function parseEvents(text: string | null): { events: LearningEvent[]; invalid: number } {
  if (!text) return { events: [], invalid: 0 };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new GitHubError("validation", `${EVENTS_FILE} in the repository is not valid JSON. Fix or delete it, then push again.`);
  }
  const list = Array.isArray(raw) ? raw : [];
  const events: LearningEvent[] = [];
  let invalid = 0;
  for (const r of list) {
    const p = LearningEvent.safeParse(r);
    if (p.success) events.push(p.data);
    else invalid++;
  }
  return { events, invalid };
}

export async function readRemoteEvents(api: GitHubApi, owner: string, repo: string, ref: string, dir: string) {
  return parseEvents(await api.readFile(owner, repo, `${dir}/${EVENTS_FILE}`, ref));
}

// ───────────────────────────────────────────── commit message
const taskById = new Map(ROADMAP.tasks.map((t) => [t.id, t]));
const dsaName = (id: string) => ROADMAP.dsaProblems.find((p) => p.id === id)?.name ?? id;
const listNames = (names: string[]) => names.slice(0, 3).join(", ") + (names.length > 3 ? ` and ${names.length - 3} more` : "");
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function describeDays(keys: string[]): string {
  const sorted = [...new Set(keys)].sort();
  if (sorted.length <= 3) return sorted.join(", ");
  return `${sorted[0]}–${sorted[sorted.length - 1]} (${sorted.length} days)`;
}

/** Reference-PrepBoard style: "Solved Two Sum" / "Completed W14D3; solved 3 DSA problems (A, B, C); passed P3 gate". */
export function commitMessage(fresh: LearningEvent[], s: UserState): string {
  const parts: string[] = [];
  const doneTasks = [...new Set(fresh.filter((e) => e.type === "TASK_COMPLETED").map((e) => (e.payload as { taskId: string }).taskId))].filter((id) => s.tasks[id]?.status === "completed");
  const touchedDays = new Set(doneTasks.map((id) => taskById.get(id)).filter(Boolean).map((t) => `${t!.week}:${t!.day}`));
  const fullDays: string[] = [];
  for (const key of touchedDays) {
    const [w, d] = key.split(":").map(Number);
    const day = ROADMAP.days.find((x) => x.week === w && x.day === d);
    if (day && day.taskIds.every((id) => ["completed", "skipped"].includes(s.tasks[id]?.status ?? ""))) fullDays.push(dayKey(w, d));
  }
  if (fullDays.length) {
    const rest = doneTasks.filter((id) => !fullDays.includes(dayKey(taskById.get(id)!.week, taskById.get(id)!.day)));
    parts.push(`Completed ${describeDays(fullDays)}${rest.length ? ` + ${plural(rest.length, "task")}` : ""}`);
  } else if (doneTasks.length === 1) {
    const t = taskById.get(doneTasks[0])!;
    parts.push(`Completed ${dayKey(t.week, t.day)} task: ${t.text.split(/(?<=\.)\s/)[0].replace(/\.$/, "").slice(0, 70)}`);
  } else if (doneTasks.length) parts.push(`Completed ${plural(doneTasks.length, "task")}`);

  const attempts = fresh.filter((e) => e.type === "DSA_ATTEMPTED").map((e) => e.payload as { problemId: string; outcome: string; mode: string });
  const firstSolves = new Map<string, string>();
  for (const a of Object.values(s.dsaAttempts).sort((x, y) => (x.at < y.at ? -1 : 1))) if (a.outcome === "solved" && !firstSolves.has(a.problemId)) firstSolves.set(a.problemId, a.id);
  const freshIds = new Set(fresh.map((e) => e.id));
  const solvedNow = [...firstSolves.entries()].filter(([, id]) => freshIds.has(id)).map(([pid]) => pid);
  if (solvedNow.length === 1) parts.push(`solved ${dsaName(solvedNow[0])}`);
  else if (solvedNow.length) parts.push(`solved ${plural(solvedNow.length, "DSA problem")} (${listNames(solvedNow.map(dsaName))})`);
  const revised = attempts.length - solvedNow.length;
  if (revised > 0) parts.push(`${revised} DSA ${revised === 1 ? "revision" : "revisions"}`);

  for (const e of fresh) {
    if (e.type === "ASSESSMENT_PASSED" && s.gates[e.payload.phase]?.status === "passed") parts.push(`passed ${e.payload.phase} gate`);
    if (e.type === "MASTERY_CONFIRMED" && s.mastery[e.payload.masteryId]?.confirmed) parts.push(`mastered ${ROADMAP.mastery.find((m) => m.id === e.payload.masteryId)?.name ?? e.payload.masteryId}`);
    if (e.type === "PROJECT_STATUS_SET" && ["completed", "shipped", "portfolio_ready"].includes(e.payload.status)) {
      const name = LAB_BY_ID.get(e.payload.projectId)?.name ?? ROADMAP.existingProjects.find((p) => p.id === e.payload.projectId)?.shortName ?? e.payload.projectId;
      parts.push(`${e.payload.status === "completed" ? "completed" : "shipped"} ${name}`);
    }
  }
  const reflections = new Set(fresh.filter((e) => e.type === "NOTE_SAVED" && /^review:W\d+:/.test(e.payload.key)).map((e) => (e.payload as { key: string }).key.split(":")[1]));
  if (reflections.size) parts.push(`wrote ${[...reflections].sort().join(", ")} reflection${reflections.size > 1 ? "s" : ""}`);
  const minutes = fresh.filter((e) => e.type === "STUDY_SESSION_COMPLETED").reduce((a, e) => a + (e.payload as { minutes: number }).minutes, 0);
  if (minutes && !parts.length) parts.push(`logged ${minutes} min of focused study`);
  if (!parts.length) {
    const checks = fresh.filter((e) => e.type === "CHECK_SET").length;
    const notes = fresh.filter((e) => e.type === "NOTE_SAVED").length;
    if (checks) parts.push(`updated ${plural(checks, "checklist item")}`);
    if (notes) parts.push(`updated ${plural(notes, "note")}`);
  }
  const msg = parts.length ? parts.join("; ") : "Update learning progress";
  const cap = msg.charAt(0).toUpperCase() + msg.slice(1);
  return cap.length > 200 ? `${cap.slice(0, 197)}…` : cap;
}

// ───────────────────────────────────────────── push
export interface PushArgs { api: GitHubApi; owner: string; repo: string; branch: string; dir: string; incoming: LearningEvent[]; tz?: string; now?: Date; attempts?: number }
export interface PushResult {
  status: "committed" | "noop";
  message: string;
  sha?: string;
  url?: string;
  pushed: number;
  total: number;
  filesChanged: number;
}

export async function pushProgress(a: PushArgs): Promise<PushResult> {
  const { api, owner, repo, branch, dir } = a;
  const now = a.now ?? new Date();
  for (let attempt = 0; attempt < (a.attempts ?? 3); attempt++) {
    let head = await api.getRef(owner, repo, branch);
    if (!head) {
      await api.createInitialCommit(owner, repo, branch, `${dir}/README.md`, "# My AI-Cloud roadmap progress\n\nTracked with AI PrepBoard.\n", "Start learning progress");
      head = await api.getRef(owner, repo, branch);
      if (!head) throw new GitHubError("conflict", "Could not initialise the branch.");
    }
    const remote = await readRemoteEvents(api, owner, repo, head.commitSha, dir);
    const known = new Set(remote.events.map((e) => e.id));
    const fresh = a.incoming.filter((e) => !known.has(e.id));
    if (!fresh.length) return { status: "noop", message: "Nothing new to push. GitHub already has all your progress.", pushed: 0, total: remote.events.length, filesChanged: 0 };

    const merged = [...remote.events, ...fresh];
    const state = reduceEvents(merged);
    const tz = state.prefStamps.timezone ? state.prefs.timezone : a.tz && isValidTimeZone(a.tz) ? a.tz : "UTC";
    const journal = serializeJournal(state, { dir, today: localDateOf(now, tz) });
    const desired: Record<string, string> = { [`${dir}/${EVENTS_FILE}`]: serializeEvents(merged), ...journal.files };
    const tree = await api.getTree(owner, repo, head.treeSha);
    const entries: TreeEntryInput[] = Object.keys(desired)
      .sort()
      .filter((p) => tree[p] !== gitBlobSha(desired[p]))
      .map((p) => ({ path: p, content: desired[p] }));
    // Milestones that no longer hold (e.g. a gate you reset) are removed; nothing else is ever deleted.
    for (const p of Object.keys(tree)) if (p.startsWith(`${dir}/milestones/`) && !(p in desired)) entries.push({ path: p, delete: true });

    const message = commitMessage(fresh, state);
    const treeSha = await api.createTree(owner, repo, head.treeSha, entries);
    const sha = await api.createCommit(owner, repo, message, treeSha, [head.commitSha]);
    try {
      await api.updateRef(owner, repo, branch, sha);
    } catch (e) {
      if (e instanceof GitHubError && e.kind === "conflict") continue; // another device pushed first — redo on top of it
      throw e;
    }
    return { status: "committed", message, sha, url: `https://github.com/${owner}/${repo}/commit/${sha}`, pushed: fresh.length, total: merged.length, filesChanged: entries.length };
  }
  throw new GitHubError("conflict", "The branch kept changing. Try again in a moment.", 409);
}

import { makeEvent } from "@/lib/state/factory";
import type { EventPayload, EventType, LearningEvent } from "@/lib/state/events";
import { gitBlobSha, GitHubError, type GitHubApi } from "@/lib/github/api";

let clock = Date.parse("2026-03-02T09:00:00Z");
export function ev<T extends EventType>(type: T, payload: EventPayload<T>, at?: string, tz = "UTC"): LearningEvent {
  const now = at ? new Date(at) : new Date((clock += 60_000));
  return makeEvent(type, payload, { tz, now, deviceId: "test-device" });
}

/** In-memory GitHub with real git blob hashing — enough to exercise the sync algorithm end to end. */
export class FakeGitHub implements GitHubApi {
  trees = new Map<string, Record<string, string>>();
  blobs = new Map<string, string>();
  commits = new Map<string, { tree: string; parents: string[]; message: string }>();
  refs = new Map<string, string>();
  writes = 0;
  failNext?: GitHubError;
  /** Simulates another device pushing between our read and our ref update. */
  raceOnce?: () => void;
  private n = 0;
  private id(p: string) {
    return `${p}${String(++this.n).padStart(38 - p.length + 2, "0")}`;
  }
  constructor(public owner = "me", public repo = "journal", seed?: Record<string, string>) {
    if (seed) {
      const tree = this.id("t");
      const map: Record<string, string> = {};
      for (const [p, c] of Object.entries(seed)) {
        const sha = gitBlobSha(c);
        this.blobs.set(sha, c);
        map[p] = sha;
      }
      this.trees.set(tree, map);
      const c = this.id("c");
      this.commits.set(c, { tree, parents: [], message: "seed" });
      this.refs.set("main", c);
    }
  }
  private check() {
    if (this.failNext) {
      const e = this.failNext;
      this.failNext = undefined;
      throw e;
    }
  }
  async defaultBranch() { this.check(); return "main"; }
  async readFile(_o: string, _r: string, path: string, ref: string) {
    const commit = this.commits.get(ref);
    if (!commit) return null;
    const sha = this.trees.get(commit.tree)![path];
    return sha ? this.blobs.get(sha)! : null;
  }
  async getRef(_o: string, _r: string, branch: string) {
    this.check();
    const sha = this.refs.get(branch);
    return sha ? { commitSha: sha, treeSha: this.commits.get(sha)!.tree } : null;
  }
  async getTree(_o: string, _r: string, sha: string) { return { ...this.trees.get(sha)! }; }
  async createInitialCommit(_o: string, _r: string, branch: string, path: string, content: string, message: string) {
    const tree = this.id("t");
    const b = gitBlobSha(content);
    this.blobs.set(b, content);
    this.trees.set(tree, { [path]: b });
    const c = this.id("c");
    this.commits.set(c, { tree, parents: [], message });
    this.refs.set(branch, c);
    this.writes++;
    return c;
  }
  async createTree(_o: string, _r: string, base: string, entries: { path: string; content?: string; delete?: boolean }[]) {
    this.check();
    const map = { ...this.trees.get(base)! };
    for (const e of entries) {
      if (e.delete) delete map[e.path];
      else {
        const b = gitBlobSha(e.content!);
        this.blobs.set(b, e.content!);
        map[e.path] = b;
      }
    }
    const t = this.id("t");
    this.trees.set(t, map);
    return t;
  }
  async createCommit(_o: string, _r: string, message: string, tree: string, parents: string[]) {
    const c = this.id("c");
    this.commits.set(c, { tree, parents, message });
    return c;
  }
  async updateRef(_o: string, _r: string, branch: string, sha: string) {
    if (this.raceOnce) {
      const race = this.raceOnce;
      this.raceOnce = undefined;
      race();
    }
    const parent = this.commits.get(sha)!.parents[0];
    if (this.refs.get(branch) !== parent) throw new GitHubError("conflict", "not a fast forward", 422);
    this.refs.set(branch, sha);
    this.writes++;
  }
  log(branch = "main"): string[] {
    const out: string[] = [];
    let c = this.refs.get(branch);
    while (c) {
      const x = this.commits.get(c)!;
      out.unshift(x.message);
      c = x.parents[0];
    }
    return out;
  }
  file(path: string, branch = "main"): string | undefined {
    const tree = this.trees.get(this.commits.get(this.refs.get(branch)!)!.tree)!;
    return tree[path] ? this.blobs.get(tree[path]) : undefined;
  }
}

import { createHash } from "node:crypto";

/** Minimal GitHub surface used by "Push progress". Implemented with fetch below, and in memory for tests. */
export interface TreeEntryInput { path: string; content?: string; delete?: boolean }
export interface GitHubApi {
  defaultBranch(owner: string, repo: string): Promise<string>;
  /** null when the branch (or the whole repository) has no commits yet. */
  getRef(owner: string, repo: string, branch: string): Promise<{ commitSha: string; treeSha: string } | null>;
  /** path → blob sha for every file in the tree. */
  getTree(owner: string, repo: string, treeSha: string): Promise<Record<string, string>>;
  /** Raw file content at a commit, or null if it does not exist. */
  readFile(owner: string, repo: string, path: string, ref: string): Promise<string | null>;
  /** First commit of an empty repository (the Git Data API cannot write to empty repos). */
  createInitialCommit(owner: string, repo: string, branch: string, path: string, content: string, message: string): Promise<string>;
  createTree(owner: string, repo: string, baseTree: string, entries: TreeEntryInput[]): Promise<string>;
  createCommit(owner: string, repo: string, message: string, tree: string, parents: string[]): Promise<string>;
  /** Fast-forward only; throws GitHubError("conflict") if the branch moved. */
  updateRef(owner: string, repo: string, branch: string, sha: string): Promise<void>;
}

export type GitHubErrorKind = "auth" | "forbidden" | "rate_limited" | "not_found" | "conflict" | "validation" | "network";
export class GitHubError extends Error {
  constructor(public kind: GitHubErrorKind, message: string, public status?: number, public retryAfter?: number) {
    super(message);
  }
}

export function explainStatus(status: number, what: string, apiMessage = "", headers?: Headers): GitHubError {
  if (status === 401) return new GitHubError("auth", "GitHub rejected the token. Check GITHUB_TOKEN (it may have expired).", 401);
  if (status === 429 || (status === 403 && (headers?.get("x-ratelimit-remaining") === "0" || /rate limit/i.test(apiMessage)))) {
    const retry = Number(headers?.get("retry-after") ?? 0) || 60;
    return new GitHubError("rate_limited", "GitHub rate limit reached. Try again in a minute.", status, retry);
  }
  if (status === 403 || status === 404)
    return new GitHubError(status === 404 ? "not_found" : "forbidden", `GitHub answered ${status} while ${what}. Check that GITHUB_REPO is "owner/repo-name" and that the token has Contents: Read and write on that repo.`, status);
  if (status === 409) return new GitHubError("conflict", `The repository changed while ${what}.`, 409);
  if (status === 422) return new GitHubError("validation", `${what}: ${apiMessage || "rejected by GitHub"}`, 422);
  return new GitHubError("network", `${what}: ${apiMessage || `HTTP ${status}`}`, status);
}

/** Git blob object id — lets us detect unchanged files without downloading them. */
export function gitBlobSha(content: string): string {
  const body = Buffer.from(content, "utf8");
  return createHash("sha1").update(`blob ${body.length}\0`).update(body).digest("hex");
}

export const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
export const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
export const BRANCH_RE = /^(?!\/|.*\/\/|.*\.\.|.*\/$)[A-Za-z0-9._/-]{1,100}$/;
export const DIR_RE = /^(?!.*\.\.)[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
export function validateRepoTarget(owner: string, repo: string, branch = "main", dir = "progress"): string | null {
  if (!OWNER_RE.test(owner)) return "GITHUB_REPO owner is not a valid GitHub name";
  if (!REPO_RE.test(repo) || repo === "." || repo === ".." || repo.endsWith(".git")) return "GITHUB_REPO repository name is invalid";
  if (branch && !BRANCH_RE.test(branch)) return "GITHUB_BRANCH is invalid";
  if (!DIR_RE.test(dir)) return "PROGRESS_DIR is invalid";
  return null;
}

/** fetch-based implementation (server only). The token never leaves the server. */
export function restApi(token: string, base = "https://api.github.com"): GitHubApi {
  const gh = async (path: string, what: string, init: RequestInit & { raw?: boolean } = {}) => {
    let r: Response;
    try {
      r = await fetch(`${base}${path}`, {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: init.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "ai-prepboard",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
      });
    } catch (e) {
      throw new GitHubError("network", `Couldn't reach GitHub while ${what}: ${e instanceof Error ? e.message : "network error"}`);
    }
    return r;
  };
  const ok = async <T>(r: Response, what: string): Promise<T> => {
    if (r.ok) return (await r.json()) as T;
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    throw explainStatus(r.status, what, j.message, r.headers);
  };
  return {
    async defaultBranch(owner, repo) {
      return (await ok<{ default_branch: string }>(await gh(`/repos/${owner}/${repo}`, "reading the repository"), "reading the repository")).default_branch;
    },
    async getRef(owner, repo, branch) {
      const r = await gh(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, "reading the branch");
      if (r.status === 404 || r.status === 409) return null; // missing branch / empty repository
      const ref = await ok<{ object: { sha: string } }>(r, "reading the branch");
      const commit = await ok<{ tree: { sha: string } }>(await gh(`/repos/${owner}/${repo}/git/commits/${ref.object.sha}`, "reading the last commit"), "reading the last commit");
      return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
    },
    async getTree(owner, repo, treeSha) {
      const t = await ok<{ tree: { path: string; type: string; sha: string }[] }>(await gh(`/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, "reading files"), "reading files");
      const out: Record<string, string> = {};
      for (const e of t.tree) if (e.type === "blob") out[e.path] = e.sha;
      return out;
    },
    async readFile(owner, repo, path, ref) {
      const r = await gh(`/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`, `reading ${path}`, { raw: true });
      if (r.status === 404) return null;
      if (!r.ok) await ok(r, `reading ${path}`);
      return r.text();
    },
    async createInitialCommit(owner, repo, branch, path, content, message) {
      const r = await ok<{ commit: { sha: string } }>(
        await gh(`/repos/${owner}/${repo}/contents/${path}`, "creating the first commit", { method: "PUT", body: JSON.stringify({ message, branch, content: Buffer.from(content, "utf8").toString("base64") }) }),
        "creating the first commit",
      );
      return r.commit.sha;
    },
    async createTree(owner, repo, baseTree, entries) {
      const tree = entries.map((e) => (e.delete ? { path: e.path, mode: "100644", type: "blob", sha: null } : { path: e.path, mode: "100644", type: "blob", content: e.content }));
      return (await ok<{ sha: string }>(await gh(`/repos/${owner}/${repo}/git/trees`, "saving files", { method: "POST", body: JSON.stringify({ base_tree: baseTree, tree }) }), "saving files")).sha;
    },
    async createCommit(owner, repo, message, tree, parents) {
      return (await ok<{ sha: string }>(await gh(`/repos/${owner}/${repo}/git/commits`, "creating the commit", { method: "POST", body: JSON.stringify({ message, tree, parents }) }), "creating the commit")).sha;
    },
    async updateRef(owner, repo, branch, sha) {
      const r = await gh(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, "updating the branch", { method: "PATCH", body: JSON.stringify({ sha, force: false }) });
      if (r.ok) return;
      // 422 "Update is not a fast forward": the branch moved while we were saving (e.g. another device pushed).
      if (r.status === 422 || r.status === 409) throw new GitHubError("conflict", "The branch moved while saving.", r.status);
      await ok(r, "updating the branch");
    },
  };
}

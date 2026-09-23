/** GitHub saving: the token stays on the server; the browser only ever knows SYNC_SECRET (if you set one). */
export interface GithubConfig { token: string; owner: string; repo: string; branch: string; dir: string; secret: string; api: string }

export function githubConfig(): GithubConfig | null {
  const token = process.env.GITHUB_TOKEN?.trim() ?? "";
  const full = process.env.GITHUB_REPO?.trim() ?? "";
  const [owner, repo] = full.split("/");
  if (!token || !owner || !repo) return null;
  return {
    token, owner, repo,
    branch: process.env.GITHUB_BRANCH?.trim() ?? "",
    dir: (process.env.PROGRESS_DIR || "progress").replace(/^\/+|\/+$/g, "") || "progress",
    secret: process.env.SYNC_SECRET ?? "",
    api: (process.env.GITHUB_API || "https://api.github.com").replace(/\/$/, ""),
  };
}
export const appUrl = () => (process.env.APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")).replace(/\/$/, "");

import type { NextRequest } from "next/server";
import { z } from "zod";
import { sameSecret } from "@/lib/auth";
import { GitHubError, restApi, validateRepoTarget } from "@/lib/github/api";
import { pushProgress, readRemoteEvents } from "@/lib/github/sync";
import { CLIENT_EVENT_TYPES, LearningEvent } from "@/lib/state/events";
import { githubConfig, type GithubConfig } from "@/lib/server/env";
import { assertSameOrigin, clientIp, HttpError, json, rateLimit, readJson, route } from "@/lib/server/http";

/**
 * Loads (GET) and saves (POST) your progress in your GitHub repo. Same model as the reference PrepBoard:
 * GITHUB_TOKEN stays on the server; the browser only knows SYNC_SECRET, sent as `x-sync-secret`.
 * The whole route is also behind the site sign-in (see src/proxy.ts).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function check(req: NextRequest): Promise<GithubConfig> {
  const c = githubConfig();
  if (!c)
    throw new HttpError(501, "github_not_configured", "GitHub saving isn't set up on this site yet. Add GITHUB_TOKEN and GITHUB_REPO (and optionally SYNC_SECRET) in Vercel → Settings → Environment Variables, then redeploy.");
  const invalid = validateRepoTarget(c.owner, c.repo, c.branch, c.dir);
  if (invalid) throw new HttpError(500, "github_misconfigured", invalid);
  if (c.secret && !(await sameSecret(req.headers.get("x-sync-secret") ?? "", c.secret))) {
    await new Promise((r) => setTimeout(r, 400));
    throw new HttpError(401, "sync_secret", req.headers.get("x-sync-secret") ? "Wrong sync password." : "Enter your sync password to connect this device.");
  }
  return c;
}

export const GET = route(async (req: NextRequest) => {
  rateLimit(`progress-get:${clientIp(req)}`, 60, 60);
  const c = await check(req);
  const api = restApi(c.token, c.api);
  const branch = c.branch || (await api.defaultBranch(c.owner, c.repo));
  const head = await api.getRef(c.owner, c.repo, branch);
  const remote = head ? await readRemoteEvents(api, c.owner, c.repo, head.commitSha, c.dir) : { events: [], invalid: 0 };
  return json({ repo: `${c.owner}/${c.repo}`, branch, dir: c.dir, requiresSecret: !!c.secret, exists: !!head, head: head?.commitSha ?? null, events: remote.events, invalid: remote.invalid });
});

const Body = z.object({ events: z.array(z.unknown()).max(50_000), tz: z.string().max(64).optional() });

export const POST = route(async (req: NextRequest) => {
  assertSameOrigin(req);
  rateLimit(`progress-post:${clientIp(req)}`, 10, 60);
  const c = await check(req);
  const body = Body.parse(await readJson(req, 12_000_000));
  const incoming: LearningEvent[] = [];
  let rejected = 0;
  const horizon = Date.now() + 5 * 60_000;
  for (const raw of body.events) {
    const e = LearningEvent.safeParse(raw);
    if (e.success && CLIENT_EVENT_TYPES.has(e.data.type) && Date.parse(e.data.occurredAt) <= horizon) incoming.push(e.data);
    else rejected++;
  }
  if (!incoming.length && body.events.length) throw new HttpError(400, "invalid_events", "None of the progress sent was valid.");
  const api = restApi(c.token, c.api);
  const branch = c.branch || (await api.defaultBranch(c.owner, c.repo));
  try {
    const r = await pushProgress({ api, owner: c.owner, repo: c.repo, branch, dir: c.dir, incoming, tz: body.tz });
    return json({ ...r, rejected, repo: `${c.owner}/${c.repo}`, branch });
  } catch (e) {
    if (e instanceof GitHubError) throw e;
    throw e;
  }
});

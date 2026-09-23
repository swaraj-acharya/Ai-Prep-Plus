import { authConfigured } from "@/lib/auth";
import { ROADMAP_CONTENT_HASH, ROADMAP_VERSION } from "@/lib/roadmap/constants";
import { githubConfig } from "@/lib/server/env";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const gh = githubConfig();
  return json({ ok: true, roadmap: ROADMAP_VERSION, contentHash: ROADMAP_CONTENT_HASH, auth: authConfigured() ? "on" : "not configured", github: gh ? "on" : "not configured" });
}

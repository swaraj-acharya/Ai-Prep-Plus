import type { NextRequest } from "next/server";
import { authConfigured, checkLogin, makeToken, sessionCookie } from "@/lib/auth";
import { clientIp, json, rateLimit, readJson, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest) => {
  rateLimit(`login:${clientIp(req)}`, 10, 300);
  if (!authConfigured()) {
    return json({ error: { code: "auth_not_configured", message: "Sign-in isn't set up yet. Add AUTH_ID and AUTH_PASSWORD in Vercel → Settings → Environment Variables, then redeploy." } }, 501);
  }
  const body = (await readJson(req, 10_000)) as { id?: unknown; password?: unknown };
  if (!(await checkLogin(body?.id, body?.password))) {
    await new Promise((r) => setTimeout(r, 800)); // slows down password guessing
    return json({ error: { code: "bad_credentials", message: "That ID or password is wrong." } }, 401);
  }
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", sessionCookie(await makeToken()));
  return res;
});

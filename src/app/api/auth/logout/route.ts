import { clearedCookie } from "@/lib/auth";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", clearedCookie());
  return res;
}

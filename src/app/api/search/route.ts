import type { NextRequest } from "next/server";
import { clientIp, json, rateLimit, route } from "@/lib/server/http";
import { search } from "@/lib/server/search";

export const GET = route(async (req: NextRequest) => {
  rateLimit(`search:${clientIp(req)}`, 120, 60);
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 120);
  return json({ q, results: search(q, 40) }, { headers: { "Cache-Control": "public, max-age=300" } });
});

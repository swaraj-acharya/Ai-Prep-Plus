import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { GitHubError } from "@/lib/github/api";
import { appUrl } from "./env";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export const json = (data: unknown, init?: number | ResponseInit) =>
  NextResponse.json(data, typeof init === "number" ? { status: init, headers: { "Cache-Control": "no-store" } } : { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });

/** Uniform error envelope: { error: { code, message } }. Internal details never leak. */
export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return json({ error: { code: e.code, message: e.message, ...e.extra } }, e.status);
  if (e instanceof ZodError) return json({ error: { code: "invalid_request", message: "Request validation failed", issues: e.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message })) } }, 400);
  if (e instanceof GitHubError) {
    const status = e.kind === "auth" ? 401 : e.kind === "rate_limited" ? 429 : e.kind === "not_found" ? 404 : e.kind === "forbidden" ? 403 : e.kind === "conflict" ? 409 : 502;
    return json({ error: { code: `github_${e.kind}`, message: e.message, retryAfter: e.retryAfter } }, { status, headers: e.retryAfter ? { "Retry-After": String(e.retryAfter) } : {} });
  }
  console.error("[prepboard] unhandled error", e);
  return json({ error: { code: "internal", message: "Something went wrong on our side. Nothing was lost; please retry." } }, 500);
}

export const route =
  <A extends unknown[]>(fn: (...args: A) => Promise<Response>) =>
  async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      return errorResponse(e);
    }
  };

/** CSRF defence for cookie-authenticated mutations: the Origin must be this app. */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) {
    if (req.headers.get("sec-fetch-site") === "same-origin") return;
    throw new HttpError(403, "bad_origin", "Cross-site request blocked");
  }
  const allowed = new Set([new URL(appUrl()).origin, req.nextUrl.origin]);
  if (!allowed.has(origin)) throw new HttpError(403, "bad_origin", "Cross-site request blocked");
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

// ───────────────────────────────────────────── rate limiting (token bucket, per instance)
const buckets = new Map<string, { tokens: number; at: number }>();
export function rateLimit(key: string, capacity: number, perSeconds: number) {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: capacity, at: now };
  b.tokens = Math.min(capacity, b.tokens + ((now - b.at) / 1000) * (capacity / perSeconds));
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    const retry = Math.ceil(((1 - b.tokens) * perSeconds) / capacity);
    throw new HttpError(429, "rate_limited", "Too many requests — slow down a little.", { retryAfter: retry });
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (now - v.at > 600_000) buckets.delete(k);
}

export async function readJson(req: NextRequest, maxBytes = 2_000_000): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "too_large", "Request body too large");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "too_large", "Request body too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "Body must be JSON");
  }
}

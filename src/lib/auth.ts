/**
 * Owner sign-in for the whole site (same model as github.com/swaraj-acharya/PrepBoard).
 * Your ID and password live in environment variables (AUTH_ID, AUTH_PASSWORD) — never in code.
 * After signing in, the browser keeps an HttpOnly cookie "<expiry>.<HMAC>" for 7 days.
 * Changing AUTH_PASSWORD (or AUTH_SECRET) signs out every device.
 * Uses Web Crypto only, so it runs in the proxy, route handlers and tests alike.
 */
export const COOKIE = "prepboard_auth";
export const MAX_AGE = 7 * 24 * 60 * 60; // seconds

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const authConfigured = () => Boolean(process.env.AUTH_ID && process.env.AUTH_PASSWORD);
/** Local development without AUTH_* is left open so `npm run dev` just works; production stays locked. */
export const authBypass = () => !authConfigured() && process.env.NODE_ENV !== "production";

async function hmac(text: string): Promise<string> {
  const secret = process.env.AUTH_SECRET || `${process.env.AUTH_ID}\n${process.env.AUTH_PASSWORD}`;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}

export function sameString(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
/** Compares SHA-256 digests, so the check takes the same time whatever was typed. */
export async function sameSecret(a: unknown, b: unknown): Promise<boolean> {
  const h = async (s: unknown) => b64url(await crypto.subtle.digest("SHA-256", enc.encode(String(s ?? ""))));
  return sameString(await h(a), await h(b));
}

export async function checkLogin(id: unknown, password: unknown): Promise<boolean> {
  if (!authConfigured()) return false;
  const [a, b] = await Promise.all([sameSecret(id, process.env.AUTH_ID), sameSecret(password, process.env.AUTH_PASSWORD)]);
  return a && b;
}

/** "<expiry ms>.<signature>" — the server checks the expiry, so an old cookie cannot be replayed forever. */
export async function makeToken(now = Date.now()): Promise<string> {
  const exp = now + MAX_AGE * 1000;
  return `${exp}.${await hmac(`v1.${exp}`)}`;
}
export async function verifyToken(token: unknown, now = Date.now()): Promise<boolean> {
  if (!authConfigured() || typeof token !== "string") return false;
  const [exp, sig] = token.split(".");
  if (!/^\d+$/.test(exp || "") || Number(exp) < now) return false;
  return sameString(sig || "", await hmac(`v1.${exp}`));
}

export const secureCookies = () => process.env.NODE_ENV === "production";
export const sessionCookie = (token: string) => `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secureCookies() ? "; Secure" : ""}`;
export const clearedCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureCookies() ? "; Secure" : ""}`;

/** Only ever send people back to a page on this site after signing in. */
export const safeNext = (n: unknown) =>
  typeof n === "string" && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") && !n.startsWith("/login") ? n : "/";

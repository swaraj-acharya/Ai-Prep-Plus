import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authBypass, checkLogin, makeToken, safeNext, sameSecret, verifyToken } from "@/lib/auth";

describe("owner sign-in", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.AUTH_ID = "swaraj";
    process.env.AUTH_PASSWORD = "correct horse battery staple";
    delete process.env.AUTH_SECRET;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("accepts only the configured ID and password", async () => {
    expect(await checkLogin("swaraj", "correct horse battery staple")).toBe(true);
    expect(await checkLogin("swaraj", "wrong")).toBe(false);
    expect(await checkLogin("someone", "correct horse battery staple")).toBe(false);
    expect(await checkLogin(undefined, null)).toBe(false);
    expect(await sameSecret("a", "a")).toBe(true);
  });
  it("issues signed, expiring cookies that a password change invalidates", async () => {
    const now = Date.parse("2026-03-01T00:00:00Z");
    const token = await makeToken(now);
    expect(await verifyToken(token, now + 1000)).toBe(true);
    expect(await verifyToken(token, now + 8 * 24 * 3600 * 1000)).toBe(false); // after 7 days
    expect(await verifyToken(token.replace(/.$/, "x"), now)).toBe(false);
    expect(await verifyToken(`${now + 999999999}.${token.split(".")[1]}`, now)).toBe(false); // extended expiry, same signature
    process.env.AUTH_PASSWORD = "new password";
    expect(await verifyToken(token, now + 1000)).toBe(false);
  });
  it("is locked in production when not configured, open only for local development", () => {
    delete process.env.AUTH_ID;
    delete process.env.AUTH_PASSWORD;
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect(authBypass()).toBe(false);
    (process.env as Record<string, string>).NODE_ENV = "development";
    expect(authBypass()).toBe(true);
  });
  it("only redirects back to pages on this site", () => {
    expect(safeNext("/today")).toBe("/today");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("/login")).toBe("/");
  });
});

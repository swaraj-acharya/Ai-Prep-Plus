"use client";
import { useState } from "react";
import { cx, inputCls } from "@/components/ui";

export default function Login() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id.trim(), password }) });
      const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!r.ok) {
        setError(j.error?.message || "Couldn't sign in. Try again.");
        setPassword("");
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      // Full page load, so every page starts fresh with your sign-in.
      window.location.assign(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch {
      setError("Couldn't reach the site. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-[80dvh] place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={44} height={44} className="mb-3 rounded-lg" />
        <h1 className="text-xl font-semibold">AI PrepBoard</h1>
        <p className="mt-1 text-sm text-muted">Sign in to see your roadmap.</p>
        <label className="mt-5 block text-sm">
          <span className="mb-1 block text-xs text-muted">ID</span>
          <input className={inputCls} autoComplete="username" autoCapitalize="none" spellCheck={false} value={id} onChange={(e) => setId(e.target.value)} required autoFocus />
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-xs text-muted">Password</span>
          <input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && (
          <p className="mt-3 rounded-md bg-bad-soft px-3 py-2 text-sm text-bad" role="alert">
            {error}
          </p>
        )}
        <button className={cx("mt-5 h-10 w-full rounded-md bg-accent text-sm font-medium text-accent-ink disabled:opacity-50")} disabled={busy || !id.trim() || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-3 text-center text-xs text-muted">You&apos;ll stay signed in on this device for 7 days.</p>
      </form>
    </div>
  );
}

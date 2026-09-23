"use client";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button, Card, cx, inputCls, PageHeader } from "@/components/ui";
import { Loading } from "@/components/domain";
import { PushPanel } from "@/components/push";
import { enableSync, useLearning } from "@/lib/client/store";

const LAYOUT: [string, string][] = [
  ["events.json", "your complete learning log — the source of truth every device loads"],
  ["README.md", "summary, streak, last 14 days and your recent history"],
  ["HISTORY.md", "every active day, newest first"],
  ["daily/YYYY/DATE.md", "one file per study day (plus .json)"],
  ["weekly/WNN.md", "week summaries"],
  ["milestones/", "gates, mastery, DSA counts, finished projects"],
  ["dsa/", "problem log and mistake patterns"],
  ["projects/", "project status and evidence"],
  ["reflections/", "weekly reflections"],
];

export function GithubView() {
  const { hydrated, sync, connect, disconnect } = useLearning(useShallow((s) => ({ hydrated: s.hydrated, sync: s.sync, connect: s.connect, disconnect: s.disconnect })));
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  if (!hydrated) return <Loading />;
  const off = sync.configured && !sync.connected && !sync.requiresSecret;
  return (
    <>
      <PageHeader
        title="Save progress to GitHub"
        lead="Study as usual; nothing is sent to GitHub until you click Push progress now. Everything you changed since your last push goes up together as one commit in the progress folder of your repo. Commits count on your contribution graph, and opening the site on another device loads what you pushed."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {sync.configured === null ? (
            <Card>
              <Loading />
            </Card>
          ) : sync.configured === false ? (
            <Card title="Not set up on this site yet">
              <p className="text-sm text-muted">{sync.message}</p>
            </Card>
          ) : sync.connected ? (
            <Card title={`Connected to ${sync.repo}`} action={<span className="font-mono text-xs text-muted">{sync.branch}</span>}>
              <PushPanel />
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                <Button variant="ghost" size="sm" onClick={() => void useLearning.getState().pull()}>
                  Load from GitHub now
                </Button>
                <Button variant="ghost" size="sm" onClick={disconnect}>
                  Stop saving to GitHub on this device
                </Button>
              </div>
            </Card>
          ) : sync.requiresSecret ? (
            <Card title="Connect this device">
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!pw.trim()) return;
                  setBusy(true);
                  await connect(pw);
                  setBusy(false);
                  setPw("");
                }}
              >
                <label className="min-w-56 flex-1 text-sm">
                  <span className="mb-1 block text-xs text-muted">Sync password (SYNC_SECRET)</span>
                  <input className={inputCls} type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} />
                </label>
                <Button variant="primary" disabled={busy || !pw.trim()}>
                  <KeyRound className="size-4" /> {busy ? "Connecting…" : "Connect"}
                </Button>
              </form>
              <p className={cx("mt-2 text-xs", sync.state === "error" ? "text-bad" : "text-muted")}>{sync.state === "error" ? sync.message : "Do this once per device. The password is kept in this browser only."}</p>
            </Card>
          ) : off ? (
            <Card title="Saving is off on this device">
              <p className="text-sm text-muted">{sync.message}</p>
              <Button className="mt-3" variant="primary" onClick={enableSync}>
                Turn GitHub saving back on
              </Button>
            </Card>
          ) : (
            <Card title="GitHub">
              <p className={cx("text-sm", sync.state === "error" ? "text-bad" : "text-muted")}>{sync.message}</p>
              <Button className="mt-3" onClick={() => void useLearning.getState().pull()}>
                Try again
              </Button>
            </Card>
          )}

          <Card title="How to set it up">
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>
                <b>Create a GitHub token.</b> Open{" "}
                <a className="text-info underline" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                  GitHub → Fine-grained tokens → Generate new token
                </a>
                . Under Repository access choose <i>Only select repositories</i> and pick the repo that should hold your progress (this app&apos;s repo works). Under Permissions set <i>Contents</i> to <i>Read and write</i>.
              </li>
              <li>
                <b>Add it to Vercel.</b> Settings → Environment Variables: <code>GITHUB_TOKEN</code> (the token), <code>GITHUB_REPO</code> (<code>yourname/your-repo</code>), and <code>SYNC_SECRET</code> (a long password you make up). Optional:{" "}
                <code>GITHUB_BRANCH</code>, <code>PROGRESS_DIR</code> (default <code>progress</code>). Redeploy.
              </li>
              <li>
                <b>Connect each device</b> once with your <code>SYNC_SECRET</code> on this page.
              </li>
              <li>
                <b>Push when you&apos;re done.</b> After a study session click <i>Push progress now</i> (or the “not pushed” badge in the top bar). Unpushed changes stay safe in this browser until then.
              </li>
            </ol>
            <p className="mt-3 text-xs text-muted">
              The token only lives on the server, never in the browser or the code. Commits that only change <code>progress/</code> don&apos;t trigger a new Vercel deploy (see <code>vercel.json</code>). If your repo is public, your progress (including notes
              and reflections) is public too. Commits count on your contribution graph when they land on the default branch of a repo that isn&apos;t a fork; for a private repo, also turn on “Private contributions” in your GitHub profile.
            </p>
          </Card>
        </div>
        <aside className="space-y-4">
          <Card title="What gets committed">
            <ul className="space-y-1.5 text-sm">
              {LAYOUT.map(([f, what]) => (
                <li key={f}>
                  <code className="text-xs">
                    {sync.dir ?? "progress"}/{f}
                  </code>
                  <span className="block text-xs text-muted">{what}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Commit messages">
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
              <li>Completed W14D3; solved Two Sum</li>
              <li>Completed W14D1–W14D5 (5 days) + 2 tasks; passed P2 gate</li>
              <li>Solved 3 DSA problems (3Sum, Two Sum, Valid Anagram); 2 DSA revisions</li>
              <li>Wrote W14 reflection</li>
            </ul>
            <p className="mt-2 text-xs text-muted">One commit per push, dated when you push. Pushing with nothing new creates no commit.</p>
          </Card>
        </aside>
      </div>
    </>
  );
}

"use client";
import { ExternalLink, LoaderCircle, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { pendingEvents, useLearning } from "@/lib/client/store";
import type { LearningEvent } from "@/lib/state/events";
import { Button, cx, Modal } from "./ui";

export function usePending(): LearningEvent[] {
  const { events, remoteIds, rev } = useLearning(useShallow((s) => ({ events: s.events, remoteIds: s.remoteIds, rev: s.rev })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => pendingEvents({ events, remoteIds }), [events, remoteIds, rev]);
}

const LABELS: [string[], string, string][] = [
  [["TASK_COMPLETED"], "task completed", "tasks completed"],
  [["DSA_ATTEMPTED"], "DSA attempt", "DSA attempts"],
  [["CHECK_SET"], "checklist change", "checklist changes"],
  [["MASTERY_CONFIRMED", "MASTERY_REVOKED"], "mastery change", "mastery changes"],
  [["ASSESSMENT_STARTED", "ASSESSMENT_PASSED", "ASSESSMENT_NEEDS_REVISIT", "ASSESSMENT_RESET"], "gate change", "gate changes"],
  [["PROJECT_STATUS_SET", "PROJECT_EVIDENCE_SET"], "project update", "project updates"],
  [["NOTE_SAVED"], "note", "notes"],
  [["STUDY_SESSION_COMPLETED"], "study session", "study sessions"],
  [["TASK_STARTED", "TASK_UNCOMPLETED", "TASK_SKIPPED", "TASK_DEFERRED"], "task status change", "task status changes"],
  [["PREFERENCES_UPDATED", "LEGACY_IMPORTED"], "setting", "settings"],
];
export function summarize(events: LearningEvent[]): string[] {
  const out: string[] = [];
  for (const [types, one, many] of LABELS) {
    const n = events.filter((e) => types.includes(e.type)).length;
    if (n) out.push(`${n} ${n === 1 ? one : many}`);
  }
  return out;
}

/** The panel used on the GitHub page and in the "not pushed" dialog. */
export function PushPanel({ compact }: { compact?: boolean }) {
  const { sync, pushNow } = useLearning(useShallow((s) => ({ sync: s.sync, pushNow: s.pushNow })));
  const pending = usePending();
  const parts = summarize(pending);
  const busy = sync.state === "syncing";
  return (
    <div className="space-y-3 text-sm">
      <p className={cx("font-medium", pending.length ? "text-accent" : "text-muted")}>
        {pending.length ? `${pending.length} change${pending.length === 1 ? "" : "s"} waiting to be pushed` : "No changes waiting to be pushed."}
        {parts.length > 0 && <span className="block text-xs font-normal text-muted">{parts.join(" · ")}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={busy || !sync.connected} onClick={() => void pushNow()}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <UploadCloud className="size-4" />} {busy ? "Pushing…" : "Push progress now"}
        </Button>
        {!compact && sync.repo && (
          <a href={`https://github.com/${sync.repo}/tree/${sync.branch ?? "main"}/${sync.dir ?? "progress"}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-info hover:underline">
            {sync.repo}/{sync.dir} <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      {sync.message && (
        <p role="status" className={cx("rounded-md px-3 py-2 text-xs", sync.state === "error" ? "bg-bad-soft text-bad" : "bg-surface-2 text-muted")}>
          {sync.message}
          {sync.state !== "error" && sync.checkedAt ? ` Last checked ${new Date(sync.checkedAt).toLocaleTimeString()}.` : ""}
          {sync.lastPush?.url && sync.state !== "syncing" && (
            <>
              {" "}
              <a href={sync.lastPush.url} target="_blank" rel="noreferrer" className="text-info underline">
                See the last commit
              </a>
              .
            </>
          )}
        </p>
      )}
      {!sync.connected && (
        <p className="text-xs text-muted">
          GitHub saving isn&apos;t connected on this device.{" "}
          <Link href="/github" className="text-info underline">
            Set it up
          </Link>
          .
        </p>
      )}
    </div>
  );
}

/** Top-bar badge: "N not pushed" → dialog with the push button (like the reference nav). */
export function PushBadge() {
  const { hydrated, connected } = useLearning(useShallow((s) => ({ hydrated: s.hydrated, connected: s.sync.connected })));
  const pending = usePending();
  const [open, setOpen] = useState(false);
  if (!hydrated || !connected || !pending.length) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} title="Push your progress to GitHub" className="flex h-8 items-center gap-1.5 rounded-md border border-accent/40 bg-accent-soft px-2 text-xs font-medium text-accent">
        <UploadCloud className="size-3.5" />
        {pending.length} not pushed
      </button>
      <Modal open={open} onOpenChange={setOpen} title="Push progress to GitHub" description="Everything you changed since your last push goes up together as one commit.">
        <PushPanel compact />
      </Modal>
    </>
  );
}

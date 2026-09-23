"use client";
import { Download, LogOut, UploadCloud, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button, Card, Checkbox, cx, inputCls, Modal, PageHeader, selectCls, Tabs } from "@/components/ui";
import { Loading } from "@/components/domain";
import { useTheme } from "@/components/shell/status";
import { useLS } from "@/lib/client/hooks";
import { useLearning } from "@/lib/client/store";
import { browserTimeZone, isValidTimeZone } from "@/lib/dates";
import { ROADMAP_CONTENT_HASH, ROADMAP_VERSION } from "@/lib/roadmap/constants";
import { exportBackup, importAny, type ImportReport } from "@/lib/state/legacy";
import { usePending } from "@/components/push";
import Link from "next/link";

export function SettingsView() {
  const { hydrated, state, dispatch, tz } = useLS();
  const { events, ingest, resetDevice, deviceId, sync } = useLearning(
    useShallow((s) => ({ events: s.events, ingest: s.ingest, resetDevice: s.resetDevice, deviceId: s.deviceId, sync: s.sync })),
  );
  const pending = usePending();
  const [theme, setTheme] = useTheme();
  const p = state.prefs;
  const [form, setForm] = useState<null | { timezone: string; streakThreshold: number; intervals: string; startDate: string; dailyTargetMinutes: number }>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const zones = useMemo(() => {
    try {
      const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
      return list.length ? [...new Set(["UTC", ...list])] : [];
    } catch {
      return [];
    }
  }, []);
  if (!hydrated) return <Loading />;
  const f = form ?? { timezone: tz(), streakThreshold: p.streakThreshold, intervals: p.revisionIntervals.join(", "), startDate: p.startDate, dailyTargetMinutes: p.dailyTargetMinutes };
  const save = () => {
    const intervals = f.intervals.split(/[,\s]+/).filter(Boolean).map(Number);
    if (!isValidTimeZone(f.timezone)) return setMsg("Unknown time zone.");
    if (!intervals.length || intervals.some((n) => !Number.isInteger(n) || n < 1 || n > 365)) return setMsg("Revision intervals must be whole days between 1 and 365.");
    if (intervals.some((n, i) => i > 0 && n <= intervals[i - 1])) return setMsg("Revision intervals must increase.");
    const e = dispatch("PREFERENCES_UPDATED", { patch: { timezone: f.timezone, streakThreshold: f.streakThreshold, revisionIntervals: intervals, startDate: f.startDate, dailyTargetMinutes: f.dailyTargetMinutes } });
    setMsg(e ? "Saved." : "Some values are out of range.");
    if (e) setForm(null);
  };
  const exportFile = () => {
    const blob = new Blob([JSON.stringify(exportBackup([...events.values()]), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ai-prepboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const readFile = async (file: File) => {
    try {
      if (file.size > 20_000_000) throw new Error("File is larger than 20 MB.");
      setReport(importAny(JSON.parse(await file.text()), tz()));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not read that file.");
    }
  };
  return (
    <>
      <PageHeader title="Settings" />
      {msg && (
        <div className="mb-4 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-sm" role="status">
          {msg}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Study preferences" className="lg:row-span-2">
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Time zone — decides which calendar day your work counts for (browser: {browserTimeZone()})</span>
              {zones.length ? (
                <select className={cx(selectCls, "w-full")} value={f.timezone} onChange={(e) => setForm({ ...f, timezone: e.target.value })}>
                  {(zones.includes(f.timezone) ? zones : [f.timezone, ...zones]).map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              ) : (
                <input className={inputCls} value={f.timezone} onChange={(e) => setForm({ ...f, timezone: e.target.value })} />
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Daily goal — study units per day (roadmap tasks, DSA problems solved, project milestones). Reaching it keeps your streak.</span>
              <input type="number" min={1} max={20} className={inputCls} value={f.streakThreshold} onChange={(e) => setForm({ ...f, streakThreshold: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">DSA revision intervals (days after first solve)</span>
              <input className={inputCls} value={f.intervals} onChange={(e) => setForm({ ...f, intervals: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Start date — used only to show how far ahead or behind the calendar you are</span>
              <input type="date" className={inputCls} value={f.startDate} onChange={(e) => setForm({ ...f, startDate: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Daily study target (minutes)</span>
              <input type="number" min={15} max={900} className={inputCls} value={f.dailyTargetMinutes} onChange={(e) => setForm({ ...f, dailyTargetMinutes: Math.max(15, Math.min(900, Number(e.target.value) || 15)) })} />
            </label>
            <Checkbox checked={p.mustOnly} onChange={(v) => dispatch("PREFERENCES_UPDATED", { patch: { mustOnly: v } })} label="Must-only mode" sub="Hide Should/Nice tasks on Today" />
            <div className="flex gap-2 pt-1">
              <Button variant="primary" onClick={save} disabled={!form}>
                Save preferences
              </Button>
              {form && (
                <Button variant="ghost" onClick={() => setForm(null)}>
                  Discard
                </Button>
              )}
            </div>
          </div>
        </Card>
        <Card title="Account" id="account">
          <div className="space-y-3 text-sm">
            <p className="text-muted">You&apos;re signed in on this device for 7 days. Your progress is saved in this browser{sync.connected ? ` and pushed to ${sync.repo} when you choose` : ""}.</p>
            <Button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
                window.location.assign("/login");
              }}
            >
              <LogOut className="size-4" /> Sign out on this device
            </Button>
          </div>
        </Card>
        <Card title="Save progress to GitHub">
          <p className="text-sm text-muted">
            {sync.connected ? `${pending.length ? `${pending.length} change${pending.length === 1 ? "" : "s"} not pushed yet.` : "Everything is pushed."}` : sync.configured === false ? "Not set up on this site." : "Not connected on this device."}
          </p>
          <Link href="/github" className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3.5 text-sm font-medium hover:border-line-strong">
            <UploadCloud className="size-4" /> Open GitHub saving
          </Link>
        </Card>
        <Card title="Appearance">
          <Tabs value={theme} onChange={setTheme} items={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "system", label: "System" }]} />
        </Card>
        <Card title="Data" id="data" className="lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportFile}>
              <Download className="size-4" /> Export backup
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Import backup or Learning OS file
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              Reset this device
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            {events.size.toLocaleString()} events on this device · roadmap {ROADMAP_VERSION} ({ROADMAP_CONTENT_HASH}) · device {deviceId.slice(0, 8)}. Imports from the original single-file Learning OS keep completion dates, notes, checklists and
            timer history; VLSI checklist entries are dropped.
          </p>
        </Card>
      </div>
      {report && (
        <Modal open onOpenChange={(v) => !v && setReport(null)} title={report.kind === "legacy" ? "Import Learning OS progress" : "Import backup"} description="Review before importing. Importing adds events; it never deletes anything, and importing the same file twice is safe.">
          <ul className="space-y-1 text-sm">
            {Object.entries(report.summary).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span className="text-muted">{k}</span>
                <span className="font-mono">{v}</span>
              </li>
            ))}
            <li className="flex justify-between">
              <span className="text-muted">skipped entries</span>
              <span className="font-mono">{report.dropped.length}</span>
            </li>
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReport(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                const n = await ingest(report.events);
                setReport(null);
                setMsg(`Imported ${n} new events${report.events.length - n ? ` (${report.events.length - n} were already present)` : ""}.`);
              }}
            >
              Import {report.events.length} events
            </Button>
          </div>
        </Modal>
      )}
      {confirmReset && (
        <Modal open onOpenChange={setConfirmReset} title="Reset this device?" description={sync.connected ? "Local data is cleared and re-loaded from GitHub. Changes you haven't pushed will be lost." : "All progress stored in this browser will be deleted. Export a backup first."}>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await resetDevice();
                setConfirmReset(false);
                setMsg("This device was reset.");
              }}
            >
              Reset
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

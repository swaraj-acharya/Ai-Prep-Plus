"use client";
import { create } from "zustand";
import { clear, createStore, del, get, set, setMany, values, type UseStore } from "idb-keyval";
import { browserTimeZone, localDateOf } from "@/lib/dates";
import { ROADMAP_VERSION } from "@/lib/roadmap/constants";
import { LearningEvent, type EventPayload, type EventType } from "@/lib/state/events";
import { makeEvent, uuid } from "@/lib/state/factory";
import { applyEvent, emptyState, reduceEvents, type UserState } from "@/lib/state/reducer";

/**
 * Local-first learning store + "Push progress now" GitHub sync (same model as the reference PrepBoard).
 *  - Every action is a validated event, saved in IndexedDB on this device first. Works offline.
 *  - Opening the app (or coming back to the tab) loads the log from GitHub and merges it in, so devices stay in sync.
 *  - Nothing is sent to GitHub until you click "Push progress now"; then everything since the last push goes
 *    up together as ONE commit. Unpushed changes stay safe in this browser until then.
 */
export type SyncState = "off" | "syncing" | "ok" | "error";
export interface SyncStatus {
  configured: boolean | null;
  requiresSecret: boolean;
  connected: boolean;
  state: SyncState;
  message: string;
  repo?: string;
  branch?: string;
  dir?: string;
  checkedAt?: string;
  lastPush?: { at: string; message: string; url?: string; pushed: number };
}
export interface TimerState { startedAt: string; taskId?: string }

const eventsDb: () => UseStore = (() => {
  let s: UseStore | null = null;
  return () => (s ??= createStore("prepboard", "events"));
})();
const metaDb: () => UseStore = (() => {
  let s: UseStore | null = null;
  return () => (s ??= createStore("prepboard-meta", "kv"));
})();
const ls = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      if (v === null || v === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* storage disabled — in-memory state still works */
    }
  },
};
const SYNC_KEY = "pb_sync";
const syncPrefs = () => ls.get<{ secret?: string; off?: boolean }>(SYNC_KEY, {});

export interface LearningStore {
  hydrated: boolean;
  events: Map<string, LearningEvent>;
  state: UserState;
  rev: number;
  /** Ids of events GitHub already has (as of the last pull/push). Everything else is "not pushed". */
  remoteIds: Set<string>;
  sync: SyncStatus;
  timer: TimerState | null;
  deviceId: string;
  tz: () => string;
  today: () => string;
  init: () => Promise<void>;
  dispatch: <T extends EventType>(type: T, payload: EventPayload<T>) => LearningEvent | null;
  ingest: (events: LearningEvent[]) => Promise<number>;
  pull: (opts?: { quiet?: boolean }) => Promise<boolean>;
  pushNow: () => Promise<void>;
  connect: (secret: string) => Promise<boolean>;
  disconnect: () => void;
  startTimer: (taskId?: string) => void;
  stopTimer: (opts?: { discard?: boolean }) => number;
  resetDevice: () => Promise<void>;
}

let pushing = false;
let pulling: Promise<boolean> | null = null;

export const pendingEvents = (s: Pick<LearningStore, "events" | "remoteIds">) => [...s.events.values()].filter((e) => !s.remoteIds.has(e.id));

export const useLearning = create<LearningStore>((setS, getS) => {
  const bump = () => setS((s) => ({ rev: s.rev + 1, state: s.state }));
  const setSync = (patch: Partial<SyncStatus>) => setS((s) => ({ sync: { ...s.sync, ...patch } }));
  const saveRemoteIds = (ids: Set<string>) => set("remoteIds", [...ids], metaDb()).catch(() => {});

  return {
    hydrated: false,
    events: new Map(),
    state: emptyState(),
    rev: 0,
    remoteIds: new Set(),
    sync: { configured: null, requiresSecret: false, connected: false, state: "off", message: "" },
    timer: null,
    deviceId: "",
    tz: () => {
      const s = getS().state;
      return s.prefStamps.timezone ? s.prefs.timezone : browserTimeZone();
    },
    today: () => localDateOf(new Date(), getS().tz()),

    async init() {
      if (getS().hydrated) return;
      const deviceId = ls.get<string>("pb_device", "") || uuid();
      ls.set("pb_device", deviceId);
      let list: LearningEvent[] = [];
      let remote: string[] = [];
      let lastPush: SyncStatus["lastPush"];
      try {
        list = ((await values(eventsDb())) as unknown[]).map((e) => LearningEvent.safeParse(e)).filter((r) => r.success).map((r) => r.data!);
        remote = ((await get("remoteIds", metaDb())) as string[] | undefined) ?? [];
        lastPush = (await get("lastPush", metaDb())) as SyncStatus["lastPush"];
      } catch (e) {
        console.warn("[prepboard] IndexedDB unavailable; running in memory only", e);
      }
      setS({
        hydrated: true, deviceId, events: new Map(list.map((e) => [e.id, e])), state: reduceEvents(list), rev: 1,
        remoteIds: new Set(remote), timer: ls.get<TimerState | null>("pb_timer", null), sync: { ...getS().sync, lastPush },
      });
      void getS().pull();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && !pushing) void getS().pull({ quiet: true });
      });
      window.addEventListener("online", () => void getS().pull({ quiet: true }));
    },

    dispatch(type, payload) {
      const s = getS();
      let e: LearningEvent;
      try {
        e = makeEvent(type, payload, { tz: s.tz(), deviceId: s.deviceId, roadmapVersion: ROADMAP_VERSION });
      } catch (err) {
        console.error("[prepboard] rejected invalid event", type, err);
        return null;
      }
      s.events.set(e.id, e);
      applyEvent(s.state, e);
      bump();
      void set(e.id, e, eventsDb()).catch((err) => console.warn("[prepboard] could not save locally", err));
      return e;
    },

    async ingest(events) {
      const s = getS();
      const fresh = events.filter((e) => !s.events.has(e.id));
      if (!fresh.length) return 0;
      for (const e of fresh) {
        s.events.set(e.id, e);
        applyEvent(s.state, e);
      }
      bump();
      await setMany(fresh.map((e) => [e.id, e]), eventsDb()).catch(() => {});
      return fresh.length;
    },

    pull({ quiet = false } = {}) {
      if (pulling) return pulling;
      pulling = (async () => {
        const prefs = syncPrefs();
        if (prefs.off) {
          setSync({ connected: false, state: "off", message: "GitHub saving is turned off on this device." });
          return false;
        }
        if (!quiet) setSync({ state: "syncing", message: "Loading your progress from GitHub…" });
        try {
          const r = await fetch("/api/progress", { cache: "no-store", headers: prefs.secret ? { "x-sync-secret": prefs.secret } : {} });
          const j = (await r.json().catch(() => ({}))) as {
            error?: { code?: string; message?: string }; events?: unknown[]; repo?: string; branch?: string; dir?: string; requiresSecret?: boolean; exists?: boolean;
          };
          if (r.status === 501) {
            setSync({ configured: false, connected: false, state: "off", message: j.error?.message ?? "GitHub saving isn't set up." });
            return false;
          }
          if (r.status === 401 && j.error?.code === "sync_secret") {
            setSync({ configured: true, requiresSecret: true, connected: false, state: prefs.secret ? "error" : "off", message: j.error.message ?? "" });
            return false;
          }
          if (!r.ok) throw new Error(j.error?.message ?? `Loading from GitHub failed (${r.status}).`);
          const remote = (j.events ?? []).map((e) => LearningEvent.safeParse(e)).filter((x) => x.success).map((x) => x.data!);
          await getS().ingest(remote);
          const remoteIds = new Set(remote.map((e) => e.id));
          await saveRemoteIds(remoteIds);
          setS({ remoteIds });
          const pending = pendingEvents(getS()).length;
          const patch: Partial<SyncStatus> = {
            configured: true, requiresSecret: !!j.requiresSecret, connected: true, repo: j.repo, branch: j.branch, dir: j.dir, checkedAt: new Date().toISOString(),
          };
          if (!quiet)
            Object.assign(patch, {
              state: "ok",
              message: !remote.length ? `Connected to ${j.repo}. Click Push progress now to create ${j.dir}/events.json there.` : pending ? `Connected to ${j.repo}.` : `Up to date with ${j.repo}.`,
            });
          setSync(patch);
          return true;
        } catch (e) {
          const offline = typeof navigator !== "undefined" && !navigator.onLine;
          setSync({ state: "error", message: offline ? "You're offline. Progress is saved in this browser and can be pushed later." : e instanceof Error ? e.message : "Couldn't reach GitHub." });
          return false;
        } finally {
          pulling = null;
        }
      })();
      return pulling;
    },

    async pushNow() {
      if (pushing) return;
      pushing = true;
      try {
        // Load the latest from GitHub first, so progress pushed from another device is merged, never overwritten.
        if (!(await getS().pull({ quiet: true }))) {
          if (getS().sync.state !== "error") setSync({ state: "error", message: getS().sync.message || "Connect GitHub saving first." });
          return;
        }
        const pending = pendingEvents(getS());
        if (!pending.length) {
          setSync({ state: "ok", message: "Nothing new to push. GitHub already has all your progress." });
          return;
        }
        setSync({ state: "syncing", message: `Pushing ${pending.length} change${pending.length === 1 ? "" : "s"} to GitHub as one commit…` });
        const secret = syncPrefs().secret;
        const r = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(secret ? { "x-sync-secret": secret } : {}) },
          body: JSON.stringify({ events: pending, tz: getS().tz() }),
        });
        const j = (await r.json().catch(() => ({}))) as { error?: { message?: string }; status?: string; message?: string; url?: string; pushed?: number };
        if (!r.ok) throw new Error(j.error?.message ?? `Saving to GitHub failed (${r.status}).`);
        const remoteIds = new Set(getS().remoteIds);
        for (const e of pending) remoteIds.add(e.id);
        await saveRemoteIds(remoteIds);
        const lastPush = j.status === "committed" ? { at: new Date().toISOString(), message: j.message ?? "", url: j.url, pushed: j.pushed ?? pending.length } : getS().sync.lastPush;
        if (lastPush) await set("lastPush", lastPush, metaDb()).catch(() => {});
        setS({ remoteIds });
        setSync({ state: "ok", lastPush, checkedAt: new Date().toISOString(), message: j.status === "committed" ? `Committed "${j.message}"` : j.message ?? "Pushed." });
      } catch (e) {
        setSync({ state: "error", message: `${e instanceof Error ? e.message : "Push failed."} Your progress is still saved in this browser. Try Push progress now again.` });
      } finally {
        pushing = false;
      }
    },

    async connect(secret) {
      ls.set(SYNC_KEY, { secret: secret.trim() });
      const ok = await getS().pull();
      if (!ok && getS().sync.requiresSecret) {
        ls.set(SYNC_KEY, {});
        setSync({ state: "error", message: "Wrong sync password." });
      }
      return ok;
    },
    disconnect() {
      ls.set(SYNC_KEY, { off: true });
      setSync({ connected: false, state: "off", message: "GitHub saving is turned off on this device." });
    },

    startTimer(taskId) {
      const t = { startedAt: new Date().toISOString(), ...(taskId ? { taskId } : {}) };
      ls.set("pb_timer", t);
      setS({ timer: t });
    },
    stopTimer(opts = {}) {
      const t = getS().timer;
      ls.set("pb_timer", null);
      setS({ timer: null });
      if (!t || opts.discard) return 0;
      const minutes = Math.min(1440, Math.round((Date.now() - Date.parse(t.startedAt)) / 60_000));
      if (minutes >= 1) getS().dispatch("STUDY_SESSION_COMPLETED", { startedAt: new Date(t.startedAt).toISOString(), endedAt: new Date().toISOString(), minutes, source: "timer", ...(t.taskId ? { taskId: t.taskId } : {}) });
      return minutes;
    },

    async resetDevice() {
      await clear(eventsDb()).catch(() => {});
      await del("remoteIds", metaDb()).catch(() => {});
      ls.set("pb_timer", null);
      setS({ events: new Map(), state: emptyState(), rev: getS().rev + 1, remoteIds: new Set(), timer: null });
      void getS().pull();
    },
  };
});

/** Re-enable GitHub saving on this device after "Stop saving". */
export function enableSync() {
  ls.set(SYNC_KEY, {});
  void useLearning.getState().pull();
}

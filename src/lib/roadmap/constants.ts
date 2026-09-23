import meta from "@/data/generated/meta.json";

/** Canonical roadmap identity. Every event is stamped with this so progress stays tied to the version it was recorded against. */
export const ROADMAP_VERSION: string = meta.version;
export const ROADMAP_CONTENT_HASH: string = meta.contentHash;

export const TASK_TYPE_LABEL: Record<string, string> = {
  learn: "Learn",
  code: "Code",
  dsa: "DSA",
  build: "Build",
  revise: "Revise",
  assess: "Assess",
  project: "Project",
  doc: "Document",
  cloud: "Cloud",
};

export const PRIORITY_LABEL: Record<string, string> = { M: "Must", S: "Should", N: "Nice" };

/** Mistake categories used when logging DSA attempts. */
export const MISTAKE_TYPES = [
  { id: "concept", label: "Concept gap", hint: "Didn't know the underlying idea or data structure" },
  { id: "pattern", label: "Pattern not recognised", hint: "Knew the technique, didn't see it applied here" },
  { id: "implementation", label: "Implementation bug", hint: "Right idea, wrong code: off-by-one, edge case, state" },
  { id: "complexity", label: "Complexity", hint: "Correct but too slow / too much memory" },
  { id: "communication", label: "Communication", hint: "Solved it but couldn't explain it clearly out loud" },
] as const;
export type MistakeType = (typeof MISTAKE_TYPES)[number]["id"];

export const DEFAULT_REVISION_INTERVALS = [1, 7, 21, 30];
/** Source rule: a day counts toward the streak when at least 3 study units were completed. */
export const DEFAULT_STREAK_THRESHOLD = 3;

export const TASK_STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  skipped: "Skipped",
  deferred: "Deferred",
};
export const GATE_STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  passed: "Passed",
  needs_revisit: "Needs revisit",
};
export const PROJECT_STATUS_LABEL: Record<string, string> = {
  idea: "Idea",
  planned: "Planned",
  ready: "Ready",
  in_progress: "In progress",
  paused: "Paused",
  completed: "Completed",
  shipped: "Shipped",
  portfolio_ready: "Portfolio ready",
};

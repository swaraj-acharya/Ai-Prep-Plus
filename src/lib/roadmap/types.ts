// Types for the extracted roadmap (see scripts/extract-roadmap.ts).
export type Priority = "M" | "S" | "N";
export type TaskType = "learn" | "code" | "dsa" | "build" | "revise" | "assess" | "project" | "doc" | "cloud";
export type DsaRole = "first-pass" | "second-pass" | "spaced-resolve" | "timed" | "other";

export interface Phase { id: string; name: string; short: string; weeks: number[]; goal: string }
export interface Task {
  id: string; order: number; week: number; day: number; dayIdx: number; absDay: number; phase: string;
  text: string; minutes: number; priority: Priority; type: TaskType; resource?: string; project?: string;
  auto: boolean; supporting: boolean; dsaRole?: DsaRole; problemIds?: string[];
}
export interface WeekDay { d: number; idx: number; absDay: number; title: string; minutes: number; taskIds: string[] }
export interface Week {
  n: number; phase: string; title: string; objective: string; hours: number; topics: string[]; theory: string; practice: string;
  deliverables: string[]; checkpoint: string[]; resources: string[]; review: { knowledge: string[]; practical: string[] }; days: WeekDay[];
}
export interface WeekChunk extends Week { tasks: Task[] }
export interface Day { idx: number; week: number; day: number; absDay: number; phase: string; title: string; minutes: number; taskIds: string[] }
export interface Resource { name: string; type: string; url: string; use: string; weeks: string }
export interface ExistingProject {
  id: string; tier: string; name: string; shortName: string; slug: string; weeks: string; weekNumbers: number[]; objective: string;
  tech: string[]; features: string[]; milestones: string[]; skills: string[]; deploy: string; github: string[]; sources: string; scheduledTaskIds: string[];
}
export interface Mastery { id: string; name: string; week: string; weekNumber: number; items: string[] }
export interface Assessment {
  phase: string; week: number; title: string; knowledge: string[]; coding: string[]; practical: string[]; explain: string[];
  pass_criteria: string[]; fail: string[];
}
export interface SideTrackModule { title: string; hours: number; learn: string; do: string; res: string[]; check: string[] }
export interface SideTrack {
  id: string; name: string; emoji: string; note: string; hours: string; countsTowardRoadmap: boolean; modules: SideTrackModule[];
}
export interface DsaProblem {
  id: string; order: number; name: string; difficulty: "Easy" | "Medium" | "Hard"; blind75: boolean; category: string;
  tasks: { taskId: string; role: DsaRole }[];
}
export interface Roadmap {
  version: string;
  phases: Phase[]; weeks: Week[]; days: Day[]; tasks: Task[];
  resources: Record<string, Resource>;
  existingProjects: ExistingProject[];
  mastery: Mastery[];
  assessments: Assessment[];
  dependencies: { nodes: { id: string; label: string; phase: string; week: number }[]; edges: [string, string][] };
  coverage: { source: string; topics: string; location: string }[];
  decisions: { title: string; text: string }[];
  recovery: { never_skip: string[]; compress: string[]; postpone: string[]; skip_temporarily: string[]; catch_up: string[]; rules: string[] };
  certifications: { name: string; cost: string; when: string; status: string; why: string }[];
  horizon: { title: string; text: string }[];
  finalReadiness: { category: string; id: string; items: string[] }[];
  sideTracks: SideTrack[];
  dsaProblems: DsaProblem[];
  careerBlueprint: {
    title: string; northStar: string; nonGoals: string[]; skillPillars: [string, string, string][];
    weeklyAllocation: string; certLadder: string; proofRule: string; year2: string;
  };
  taskTypes: Record<string, string>;
  priorities: Record<string, string>;
  sourceViews: { id: string; label: string }[];
}

/** Compact client-side index (task-index.json). */
export type CompactTask = [id: string, dayIdx: number, type: TaskType, priority: Priority, minutes: number, flags: number, project: string, problemIds: string];
export interface TaskIndex {
  version: string; contentHash: string;
  phases: { id: string; name: string; short: string; weeks: number[] }[];
  weeks: { n: number; phase: string; title: string; hours: number }[];
  days: { i: number; w: number; d: number; a: number; t: string; m: number; n: number }[];
  tasks: CompactTask[];
  gates: { phase: string; week: number; title: string; criteria: number }[];
  mastery: { id: string; name: string; week: number; items: number }[];
  dsa: { id: string; name: string; difficulty: string; blind75: boolean; category: string; firstTask: string }[];
  existingProjects: { id: string; name: string; tier: string; weeks: number[]; features: number; milestones: number; github: number }[];
  sideTracks: { id: string; name: string; checks: number[]; countsTowardRoadmap: boolean }[];
  finalReadiness: { category: string; items: number }[];
}

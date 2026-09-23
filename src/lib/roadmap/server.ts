/**
 * Full roadmap access for server components and route handlers only.
 * (Client components use the compact index in ./client-index + per-week chunks.)
 */
import roadmapRaw from "@/data/generated/roadmap.json";
import promptsRaw from "@/data/generated/prompts.json";
import copyRaw from "@/data/generated/copy.json";
import type { Roadmap, Task, Week } from "./types";

export interface Prompt { id: string; name: string; when: string; body: string }
export interface Copy {
  dashboardTips: string[];
  dailyLoop: string;
  blueprint: {
    howToUse: string; rule1Title: string; rule2Title: string; rule2: string; certNote: string; allocationNote: string;
    careerSpine: { weeks: string; focus: string; cloud: string; proof: string }[];
  };
  roadmap: { certsNote: string; horizonNote: string; depsHelp: string };
  projectsLead: string;
  revision: { howItWorks: string[]; masteryLead: string };
  assessLead: string; resourcesLead: string; finalLead: string; recoveryLead: string; coverageLead: string; b75Note: string;
  tutor: { lead: string; workflow: string; tips: string[] };
  sideLead: string; streakRule: string; gateWarning: string; dayComplete: string;
}

export const ROADMAP = roadmapRaw as unknown as Roadmap;
export const PROMPTS = promptsRaw as unknown as Prompt[];
export const COPY = copyRaw as unknown as Copy;

const taskMap = new Map<string, Task>(ROADMAP.tasks.map((t) => [t.id, t]));
const weekMap = new Map<number, Week>(ROADMAP.weeks.map((w) => [w.n, w]));

export const getTask = (id: string) => taskMap.get(id);
export const getWeek = (n: number) => weekMap.get(n);
export const getPhase = (id: string) => ROADMAP.phases.find((p) => p.id === id);
export const getResource = (key: string) => ROADMAP.resources[key];
export const getExistingProject = (idOrSlug: string) => ROADMAP.existingProjects.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
export const getSideTrack = (id: string) => ROADMAP.sideTracks.find((t) => t.id === id);
export const getAssessment = (phase: string) => ROADMAP.assessments.find((a) => a.phase === phase);
export const getMastery = (id: string) => ROADMAP.mastery.find((m) => m.id === id);
export const getDsaProblem = (id: string) => ROADMAP.dsaProblems.find((p) => p.id === id);

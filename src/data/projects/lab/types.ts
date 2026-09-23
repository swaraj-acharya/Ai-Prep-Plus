/**
 * Project Lab schema. The Lab is a project LIBRARY and progression system that sits beside the
 * 52-week roadmap — it never adds tasks to the daily schedule.
 */
export type LabTier = 1 | 2 | 3 | 4;
export const TIER_NAMES: Record<LabTier, string> = { 1: "Foundations", 2: "Intermediate", 3: "Advanced", 4: "Flagship" };
export const TIER_DIFFICULTY: Record<LabTier, string> = { 1: "Beginner", 2: "Intermediate", 3: "Advanced", 4: "Flagship" };

export const LAB_CATEGORIES = [
  "AI", "Cloud", "MERN", "AI + MERN", "RAG", "Search", "Agents", "MCP", "MLOps", "ML", "Inference", "Backend",
  "Distributed Systems", "DevTools", "SaaS", "Startup", "Security", "Voice", "Multimodal", "Observability", "Evaluation", "Data", "Workflow", "Industry",
] as const;
export type LabCategory = (typeof LAB_CATEGORIES)[number];

export const DSA_CATEGORIES = [
  "Arrays & Hashing", "Two Pointers", "Sliding Window", "Stack", "Binary Search", "Linked List", "Trees", "Heap / Priority Queue",
  "Backtracking", "Tries", "Graphs", "Advanced Graphs", "1-D Dynamic Programming", "2-D Dynamic Programming", "Greedy", "Intervals",
  "Math & Geometry", "Bit Manipulation",
] as const;

export interface Architecture {
  frontend?: string; api?: string; app?: string; data?: string; workers?: string; ai?: string; observability?: string; infra?: string;
}
export const ARCH_LAYERS: { key: keyof Architecture; label: string }[] = [
  { key: "frontend", label: "Frontend" },
  { key: "api", label: "API" },
  { key: "app", label: "Application layer" },
  { key: "data", label: "Database / cache" },
  { key: "workers", label: "Queue / workers" },
  { key: "ai", label: "AI / model layer" },
  { key: "observability", label: "Observability" },
  { key: "infra", label: "Cloud infrastructure" },
];

export interface StartupMode {
  whyPay: string; alternatives: string; mvp: string; differentiator: string; pricing: string; infraCost: string;
  growth: string; moat: string; distribution: string; risks: string; nextExperiment: string;
}

export interface LabProjectInput {
  id: string; name: string; tier: LabTier; categories: LabCategory[]; industry?: string;
  hours: [number, number];
  /** Roadmap week by which the core knowledge has been taught (drives unlock + recommendation). */
  unlockWeek: number;
  roadmap: { weeks: number[]; mastery: string[]; resources: string[]; dsa: string[]; gates?: string[]; certs?: string[] };
  prerequisites: string[];
  extends?: string[];
  objective: string; problem: string; users: string[];
  skills: string[]; tech: string[];
  arch: Architecture;
  features: string[]; milestones: string[];
  testing: string[]; observability?: string[]; security?: string[]; performance?: string[]; deployment: string[];
  benchmarks: string[];
  stretch: string[];
  startup?: StartupMode;
}

export interface LabProject extends LabProjectInput {
  slug: string; tierName: string; difficulty: string;
  github: string[]; evidence: { field: string; label: string; required: boolean }[]; quality: string[];
}

export const QUALITY_BY_TIER: Record<LabTier, string[]> = {
  1: ["README", "Tests", "Demo"],
  2: ["README", "Architecture", "Tests", "CI/CD", "Deployment", "Benchmark", "Demo"],
  3: ["README", "Architecture", "Tests", "CI/CD", "Security", "Observability", "Deployment", "Benchmark", "Demo", "Documentation"],
  4: ["README", "Architecture", "Architecture decisions (ADRs)", "Tests", "CI/CD", "Security", "Observability", "Deployment", "Benchmark", "Demo", "Documentation", "Technical write-up", "Postmortem"],
};

const EVIDENCE: { field: string; label: string; minTier: LabTier }[] = [
  { field: "repo", label: "GitHub repository", minTier: 1 },
  { field: "demo", label: "Live demo", minTier: 3 },
  { field: "architecture", label: "Architecture diagram", minTier: 2 },
  { field: "screenshots", label: "Screenshots", minTier: 4 },
  { field: "video", label: "Demo video", minTier: 3 },
  { field: "benchmark", label: "Benchmark report", minTier: 3 },
  { field: "coverage", label: "Coverage report", minTier: 4 },
  { field: "article", label: "Technical article", minTier: 4 },
  { field: "postmortem", label: "Postmortem", minTier: 4 },
];

const GITHUB_BY_TIER: Record<LabTier, string[]> = {
  1: ["README with problem · stack · run · screenshot", "One-command local run", "Tests in CI", "License"],
  2: ["README with architecture diagram and measured results", "docker compose up works from a clean clone", "CI: lint + tests on every PR", "Issues/PRs used for your own work", "License"],
  3: ["README: problem → architecture → results → limitations", "CI/CD with deploy + security scan", "Benchmarks reproducible from a script", "docs/ with ADRs and runbook", "Tagged releases + CHANGELOG"],
  4: ["README a hiring manager can skim in 2 minutes", "Architecture diagram + ADRs + threat model", "CI/CD with eval/benchmark gates", "Public benchmark + postmortem", "Demo video linked at the top", "Tagged releases + CHANGELOG + CONTRIBUTING"],
};

export const slugOf = (id: string) => id.replace(/^lab-/, "");

export function defineProject(p: LabProjectInput): LabProject {
  return {
    ...p,
    slug: slugOf(p.id),
    tierName: TIER_NAMES[p.tier],
    difficulty: TIER_DIFFICULTY[p.tier],
    github: GITHUB_BY_TIER[p.tier],
    evidence: EVIDENCE.map((e) => ({ field: e.field, label: e.label, required: p.tier >= e.minTier && p.tier >= 3 ? true : e.field === "repo" })),
    quality: QUALITY_BY_TIER[p.tier],
  };
}

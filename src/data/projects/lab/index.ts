import { TIER1 } from "./tier1";
import { TIER2 } from "./tier2";
import { TIER3 } from "./tier3";
import { TIER4 } from "./tier4";
import type { LabProject } from "./types";

export * from "./types";

export const LAB_PROJECTS: LabProject[] = [...TIER1, ...TIER2, ...TIER3, ...TIER4];
export const LAB_BY_ID = new Map(LAB_PROJECTS.map((p) => [p.id, p]));
export const LAB_BY_SLUG = new Map(LAB_PROJECTS.map((p) => [p.slug, p]));

/**
 * Named progression paths through the Lab. Each chain is ordered; consecutive entries are linked by
 * prerequisites (validated by scripts/validate-roadmap.ts). Existing roadmap projects (pr-*) appear
 * where a Lab chain grows out of them — the originals stay untouched.
 */
export const LAB_CHAINS: { id: string; name: string; summary: string; steps: string[] }[] = [
  {
    id: "rag", name: "Retrieval → enterprise knowledge",
    summary: "From measuring embeddings to a permission-correct knowledge platform.",
    steps: ["pr-atlas", "lab-embedding-lab", "lab-hybrid-search", "lab-query-rerank", "lab-rag-eval-harness", "lab-production-rag", "lab-enterprise-knowledge"],
  },
  {
    id: "backend", name: "API → workers → AI platform",
    summary: "Reliability primitives that every later system reuses.",
    steps: ["pr-tasks-api", "lab-idempotent-job-runner", "lab-ai-job-orchestrator", "lab-llm-observability", "lab-ai-reliability"],
  },
  {
    id: "agents", name: "Agents → agent platform",
    summary: "From a framework-free loop to a governed multi-agent runtime.",
    steps: ["pr-paper", "lab-tool-agent", "lab-mcp-server-kit", "lab-durable-agent", "lab-mcp-gateway", "lab-agent-os"],
  },
  {
    id: "paircraft", name: "PairCraft → collaborative coding intelligence",
    summary: "The original PairCraft grows into infrastructure, an AI pair programmer, then a platform.",
    steps: ["pr-paircraft", "lab-paircraft-scale", "lab-ai-pair-programmer", "lab-collaborative-coding-intel"],
  },
  {
    id: "devtools", name: "Repository map → code quality platform",
    summary: "Code understanding powering review and test generation.",
    steps: ["lab-repo-map", "lab-pr-reviewer", "lab-codebase-intelligence", "lab-test-generation", "lab-code-quality-platform"],
  },
  {
    id: "gateway", name: "LLM client → inference platform",
    summary: "From a resilient client to routing, benchmarking and GPU serving.",
    steps: ["lab-resilient-llm-client", "pr-gateway", "lab-model-gateway", "lab-inference-bench", "lab-inference-platform"],
  },
  {
    id: "security", name: "Redaction → AI security gateway",
    summary: "Defence in depth for model and tool traffic.",
    steps: ["lab-pii-redactor", "lab-prompt-firewall", "lab-mcp-gateway", "lab-ai-security-gateway"],
  },
  {
    id: "llmops", name: "Tracing → eval-gated delivery",
    summary: "Measure, gate, release and roll back AI changes like software.",
    steps: ["lab-llm-call-tracer", "lab-llm-eval-platform", "pr-llmops", "lab-eval-gated-llmops", "lab-ai-cloud-control-plane"],
  },
  {
    id: "cx", name: "Support agent → customer experience OS",
    summary: "SaaS foundations, agents and voice combined into an omnichannel product.",
    steps: ["lab-nextjs-ai-kit", "lab-saas-foundation", "lab-support-agent-platform", "lab-voice-agent", "lab-cx-os"],
  },
];

import type { LabCategory } from "@/data/projects/lab/types";

/**
 * Curated additions to the roadmap's resource library.
 *
 * The 142 source resources are preserved exactly (see MIGRATION_AUDIT.md); everything here is ADDED and shown
 * with an "Added" badge. Selection rules: free, maintained, directly useful for a roadmap week or Lab project,
 * and not a duplicate of an existing resource. GitHub repos were verified with `git` on CURATED_CHECKED_ON and
 * carry their latest commit date so you can see they are alive.
 */
export const CURATED_CHECKED_ON = "2026-09-23";

export const CURATED_AREAS = [
  "LLM engineering", "Deep learning & transformers", "Machine learning", "RAG & search", "Agents & MCP", "Evals & AI safety",
  "Inference & MLOps", "Cloud & DevOps", "System design", "CS foundations", "DSA & interviews", "Career",
] as const;
export type CuratedArea = (typeof CURATED_AREAS)[number];
export type CuratedType = "GitHub repo" | "free course" | "free book" | "docs" | "guide" | "article" | "tool" | "practice" | "certification";

export interface CuratedResource {
  key: string;
  name: string;
  url: string;
  type: CuratedType;
  area: CuratedArea;
  /** Why it is here and how to use it with the roadmap. */
  use: string;
  weeks: number[];
  categories?: LabCategory[];
  /** owner/name for GitHub repos, with the latest commit date seen when verified. */
  repo?: string;
  lastCommit?: string;
}

const gh = (repo: string, lastCommit: string) => ({ repo, lastCommit, url: `https://github.com/${repo}` });
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const CURATED: CuratedResource[] = [
  // ── LLM engineering
  { key: "x-claude-academy", name: "Claude Academy (formerly Anthropic Academy) — free courses", url: "https://anthropic.skilljar.com", type: "free course", area: "LLM engineering", weeks: [14, 15, 16, 36, 41], categories: ["AI", "Agents", "MCP"], use: "Official free courses with certificates on the Claude API, tool use, MCP and agent skills. Take the API track with W15–W16 and the MCP course with W41." },
  { key: "x-claude-cookbook", name: "Claude cookbooks (Anthropic)", ...gh("anthropics/anthropic-cookbook", "2026-09-22"), type: "GitHub repo", area: "LLM engineering", weeks: [15, 16, 20, 24, 37], categories: ["AI", "RAG", "Agents"], use: "Runnable notebooks for tool use, structured outputs, RAG, prompt caching and sub-agents — copy the patterns straight into AtlasAI and Paper-to-Prod." },
  { key: "x-anthropic-courses", name: "Anthropic courses — prompt engineering & API fundamentals", ...gh("anthropics/courses", "2025-11-13"), type: "GitHub repo", area: "LLM engineering", weeks: [15, 16], categories: ["AI"], use: "Interactive notebooks: the prompt-engineering tutorial, API fundamentals and tool use. Do the prompt tutorial before building the W15 extractor." },
  { key: "x-openai-cookbook", name: "OpenAI Cookbook", ...gh("openai/openai-cookbook", "2026-09-22"), type: "GitHub repo", area: "LLM engineering", weeks: [15, 20, 33], categories: ["AI", "RAG"], use: "Worked examples for function calling, structured outputs, embeddings, fine-tuning and evals — handy second reference for W15 and W33." },
  { key: "x-prompt-guide", name: "Prompt Engineering Guide (DAIR.AI)", ...gh("dair-ai/Prompt-Engineering-Guide", "2026-03-11"), type: "GitHub repo", area: "LLM engineering", weeks: [14, 15, 16], categories: ["AI"], use: "The most complete open guide to prompting techniques, each linked to its paper. Use it as a lookup, not a course." },
  { key: "x-genai-beginners", name: "Generative AI for Beginners (Microsoft)", ...gh("microsoft/generative-ai-for-beginners", "2026-09-18"), type: "GitHub repo", area: "LLM engineering", weeks: [14, 15, 16, 19], categories: ["AI", "RAG"], use: "21 short lessons from tokens to RAG, agents and responsible AI — a second teacher when a W14–W19 concept does not click." },
  { key: "x-llm-course", name: "LLM Course (Maxime Labonne)", ...gh("mlabonne/llm-course", "2026-02-05"), type: "GitHub repo", area: "LLM engineering", weeks: [14, 31, 32, 33, 34], categories: ["AI", "ML"], use: "Roadmaps plus Colab notebooks for LLM fundamentals, SFT/DPO fine-tuning, quantization and model merging — pairs with P4." },
  { key: "x-handson-llm", name: "Hands-On Large Language Models — code", ...gh("HandsOnLLM/Hands-On-Large-Language-Models", "2026-04-24"), type: "GitHub repo", area: "LLM engineering", weeks: [14, 19, 20, 21, 31], categories: ["AI", "RAG", "Search"], use: "Notebooks for the O'Reilly book (Alammar & Grootendorst): tokens, embeddings, semantic search, RAG and fine-tuning — very visual." },
  { key: "x-aie-book", name: "AI Engineering (Chip Huyen) — book resources", ...gh("chiphuyen/aie-book", "2026-07-03"), type: "GitHub repo", area: "LLM engineering", weeks: [22, 24, 26, 33, 36, 43], categories: ["AI", "Evaluation", "Inference"], use: "Chapter summaries and curated references for evals, RAG vs fine-tuning, inference optimisation and AI system architecture." },
  { key: "x-awesome-llm-apps", name: "Awesome LLM Apps", ...gh("Shubhamsaboo/awesome-llm-apps", "2026-09-21"), type: "GitHub repo", area: "LLM engineering", weeks: [20, 24, 37, 41], categories: ["AI", "RAG", "Agents", "MCP", "Voice"], use: "100+ runnable LLM apps (RAG, agents, MCP, voice). Mine it for Project Lab ideas and compare reference implementations after you build yours." },

  // ── Deep learning & transformers
  { key: "x-llms-from-scratch", name: "Build a Large Language Model (From Scratch) — code", ...gh("rasbt/LLMs-from-scratch", "2026-09-22"), type: "GitHub repo", area: "Deep learning & transformers", weeks: [31, 32, 33], categories: ["ML", "AI"], use: "Build, pretrain and fine-tune a GPT-style model in PyTorch step by step — the ideal companion to Karpathy's 'Let's build GPT' in W31." },
  { key: "x-nanogpt", name: "nanoGPT (Karpathy)", ...gh("karpathy/nanoGPT", "2025-11-12"), type: "GitHub repo", area: "Deep learning & transformers", weeks: [31], categories: ["ML"], use: "~300 lines of GPT training code. Read it after the Zero-to-Hero GPT lecture and reproduce a small run." },
  { key: "x-annotated-papers", name: "Annotated deep-learning paper implementations (labml.ai)", ...gh("labmlai/annotated_deep_learning_paper_implementations", "2026-01-22"), type: "GitHub repo", area: "Deep learning & transformers", weeks: [30, 31, 34], categories: ["ML"], use: "Side-by-side annotated PyTorch for transformers, attention variants, LoRA and more — read the paper and the code together." },
  { key: "x-illustrated-transformer", name: "The Illustrated Transformer (Jay Alammar)", url: "https://jalammar.github.io/illustrated-transformer/", type: "guide", area: "Deep learning & transformers", weeks: [31], use: "The classic visual walkthrough of self-attention and the transformer. Read it before drawing attention from memory." },
  { key: "x-annotated-transformer", name: "The Annotated Transformer (Harvard NLP)", url: "https://nlp.seas.harvard.edu/annotated-transformer/", type: "guide", area: "Deep learning & transformers", weeks: [31], use: "'Attention Is All You Need', line by line, as runnable PyTorch." },
  { key: "x-d2l", name: "Dive into Deep Learning (free interactive book)", url: "https://d2l.ai", repo: "d2l-ai/d2l-en", lastCommit: "2024-03-16", type: "free book", area: "Deep learning & transformers", weeks: [29, 30, 31], categories: ["ML"], use: "Free book with runnable code for every chapter (MLPs, CNNs, RNNs, attention). Stable and still the best free DL textbook." },
  { key: "x-fastai", name: "Practical Deep Learning for Coders (fast.ai)", url: "https://course.fast.ai", type: "free course", area: "Deep learning & transformers", weeks: [29, 30], categories: ["ML"], use: "Top-down, code-first deep learning. Good if Krish Naik's DL modules feel too theory-first." },

  // ── Machine learning
  { key: "x-ml-beginners", name: "ML for Beginners (Microsoft)", ...gh("microsoft/ML-For-Beginners", "2026-09-14"), type: "GitHub repo", area: "Machine learning", weeks: [27, 28], categories: ["ML"], use: "A 12-week classical-ML curriculum with quizzes — extra practice for regression, classification and clustering in P4." },
  { key: "x-handson-ml3", name: "Hands-On Machine Learning (3rd ed.) — notebooks", ...gh("ageron/handson-ml3", "2026-05-20"), type: "GitHub repo", area: "Machine learning", weeks: [27, 28, 29], categories: ["ML"], use: "End-to-end ML projects from Géron's book: data prep, pipelines, trees, ensembles, then neural nets." },
  { key: "x-mml-book", name: "Mathematics for Machine Learning (free book)", url: "https://mml-book.github.io", type: "free book", area: "Machine learning", weeks: [5, 7, 29], categories: ["ML"], use: "Linear algebra, calculus and probability exactly as ML needs them. Dip in when W5/W7 math feels shaky." },
  { key: "x-seeing-theory", name: "Seeing Theory (Brown University)", url: "https://seeing-theory.brown.edu", type: "tool", area: "Machine learning", weeks: [7], use: "Interactive visual introduction to probability, distributions and inference for the W7 statistics week." },

  // ── RAG & search
  { key: "x-rag-techniques", name: "RAG Techniques (Nir Diamant)", ...gh("NirDiamant/RAG_Techniques", "2026-09-21"), type: "GitHub repo", area: "RAG & search", weeks: [20, 21, 22, 23, 24], categories: ["RAG", "Search", "Evaluation"], use: "30+ advanced RAG techniques as runnable notebooks: chunking strategies, HyDE, reranking, fusion, graph RAG and evaluation." },
  { key: "x-ir-book", name: "Introduction to Information Retrieval (free book)", url: "https://nlp.stanford.edu/IR-book/", type: "free book", area: "RAG & search", weeks: [21], categories: ["Search"], use: "Manning, Raghavan & Schütze — inverted indexes, tf-idf/BM25 and IR evaluation. The chapters behind the W21 search week." },
  { key: "x-llm-zoomcamp", name: "LLM Zoomcamp (DataTalks.Club)", ...gh("DataTalksClub/llm-zoomcamp", "2026-09-14"), type: "GitHub repo", area: "RAG & search", weeks: [19, 20, 22, 23], categories: ["RAG", "Evaluation"], use: "Free cohort-style course: RAG, vector search, evaluation and monitoring with homework — extra reps for P3." },

  // ── Agents & MCP
  { key: "x-agents-beginners", name: "AI Agents for Beginners (Microsoft)", ...gh("microsoft/ai-agents-for-beginners", "2026-09-10"), type: "GitHub repo", area: "Agents & MCP", weeks: [36, 37, 38], categories: ["Agents"], use: "Lessons on agent design patterns, tool use, planning, multi-agent systems and production agents." },
  { key: "x-genai-agents", name: "GenAI Agents (Nir Diamant)", ...gh("NirDiamant/GenAI_Agents", "2026-09-21"), type: "GitHub repo", area: "Agents & MCP", weeks: [36, 37, 38, 39, 40], categories: ["Agents", "Workflow"], use: "45+ agent implementations (LangGraph, CrewAI, custom) from simple to complex — compare with the patterns you hand-write in W37." },
  { key: "x-12-factor-agents", name: "12-Factor Agents (HumanLayer)", ...gh("humanlayer/12-factor-agents", "2025-09-21"), type: "GitHub repo", area: "Agents & MCP", weeks: [36, 39, 40], categories: ["Agents"], use: "Principles for reliable LLM agents: own your prompts, your context window and your control flow. Read before the W40 framework choice." },
  { key: "x-context-engineering", name: "Effective context engineering for AI agents (Anthropic)", url: "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents", type: "article", area: "Agents & MCP", weeks: [39, 40], categories: ["Agents"], use: "How to budget, compact and structure context for long-running agents — the W39 memory and context-engineering topic." },
  { key: "x-mcp-servers", name: "MCP reference servers", ...gh("modelcontextprotocol/servers", "2026-09-22"), type: "GitHub repo", area: "Agents & MCP", weeks: [41], categories: ["MCP"], use: "Official reference servers (filesystem, git, fetch, memory). Read two before writing your MCP suite." },
  { key: "x-awesome-mcp", name: "Awesome MCP Servers", ...gh("punkpeye/awesome-mcp-servers", "2026-09-22"), type: "GitHub repo", area: "Agents & MCP", weeks: [41], categories: ["MCP"], use: "A large directory of community MCP servers — study how others scope tools, auth and transports." },

  // ── Evals & AI safety
  { key: "x-evals-faq", name: "LLM Evals: Everything You Need to Know (Hamel Husain & Shreya Shankar)", url: "https://hamel.dev/blog/posts/evals-faq/", type: "article", area: "Evals & AI safety", weeks: [22, 42], categories: ["Evaluation"], use: "The practical FAQ on error analysis, judges and eval pipelines — the follow-up to the W22 evals essay." },
  { key: "x-deepeval", name: "DeepEval", ...gh("confident-ai/deepeval", "2026-09-23"), type: "GitHub repo", area: "Evals & AI safety", weeks: [22, 42], categories: ["Evaluation"], use: "Pytest-style LLM evaluation (G-Eval, faithfulness, agent metrics). An alternative to RAGAS for the CI eval gate." },
  { key: "x-phoenix", name: "Arize Phoenix", ...gh("Arize-ai/phoenix", "2026-09-23"), type: "GitHub repo", area: "Evals & AI safety", weeks: [23, 42], categories: ["Observability", "Evaluation"], use: "Open-source LLM tracing and evals on OpenTelemetry — compare with Langfuse when choosing your observability stack." },
  { key: "x-garak", name: "garak — LLM vulnerability scanner (NVIDIA)", ...gh("NVIDIA/garak", "2026-09-16"), type: "GitHub repo", area: "Evals & AI safety", weeks: [42], categories: ["Security"], use: "Automated probes for prompt injection, jailbreaks and data leakage — run it for the W42 red-team report." },
  { key: "x-pyrit", name: "PyRIT — AI red-teaming toolkit (Microsoft)", ...gh("Azure/PyRIT", "2026-03-24"), type: "GitHub repo", area: "Evals & AI safety", weeks: [42], categories: ["Security"], use: "Python Risk Identification Tool for scripted, multi-turn red-teaming of generative AI systems." },

  // ── Inference & MLOps
  { key: "x-ml-engineering", name: "Machine Learning Engineering Open Book (Stas Bekman)", ...gh("stas00/ml-engineering", "2026-09-11"), type: "GitHub repo", area: "Inference & MLOps", weeks: [32, 35, 45], categories: ["Inference", "MLOps"], use: "GPUs, networking, storage, training and inference at scale — the reference for GPU economics and debugging." },
  { key: "x-ultrascale", name: "The Ultra-Scale Playbook (Hugging Face)", url: "https://huggingface.co/spaces/nanotron/ultrascale-playbook", type: "guide", area: "Inference & MLOps", weeks: [35, 45], categories: ["Inference", "MLOps"], use: "How LLM training scales across GPUs — data, tensor and pipeline parallelism with interactive memory plots." },
  { key: "x-llama-cpp", name: "llama.cpp", ...gh("ggml-org/llama.cpp", "2026-09-23"), type: "GitHub repo", area: "Inference & MLOps", weeks: [32], categories: ["Inference"], use: "Local inference and GGUF quantization — what Ollama runs underneath. Use it in the W32 quantization lab." },
  { key: "x-sglang", name: "SGLang", ...gh("sgl-project/sglang", "2026-09-23"), type: "GitHub repo", area: "Inference & MLOps", weeks: [35, 46], categories: ["Inference"], use: "High-throughput LLM serving engine — benchmark it against vLLM in the inference benchmark lab." },
  { key: "x-trl", name: "TRL — Transformer Reinforcement Learning (Hugging Face)", ...gh("huggingface/trl", "2026-09-23"), type: "GitHub repo", area: "Inference & MLOps", weeks: [33, 34], categories: ["ML"], use: "SFT, DPO and GRPO trainers used by most open fine-tuning recipes — read the SFT example before W34." },
  { key: "x-mlops-zoomcamp", name: "MLOps Zoomcamp (DataTalks.Club)", ...gh("DataTalksClub/mlops-zoomcamp", "2026-09-14"), type: "GitHub repo", area: "Inference & MLOps", weeks: [44, 45, 46, 47], categories: ["MLOps"], use: "Free MLOps course: experiment tracking, orchestration, deployment and monitoring, with homework." },
  { key: "x-made-with-ml-code", name: "Made With ML — code", ...gh("GokuMohandas/Made-With-ML", "2026-03-04"), type: "GitHub repo", area: "Inference & MLOps", weeks: [46], categories: ["MLOps"], use: "The production-ML codebase behind madewithml.com (Ray, MLflow, CI/CD) — read it alongside the W46 retrain pipeline." },

  // ── Cloud & DevOps
  { key: "x-aws-saa", name: "AWS Certified Solutions Architect – Associate (exam page & guide)", url: "https://aws.amazon.com/certification/certified-solutions-architect-associate/", type: "certification", area: "Cloud & DevOps", weeks: range(20, 24), categories: ["Cloud"], use: "The core cloud credential in your certification ladder (W20–W24). Start from the official exam guide and free Skill Builder prep." },
  { key: "x-well-architected", name: "AWS Well-Architected Framework", url: "https://aws.amazon.com/architecture/well-architected/", type: "docs", area: "Cloud & DevOps", weeks: [14, 19, 24, 47], categories: ["Cloud"], use: "The six pillars behind the SAA exam and every architecture review — use its questions for your design docs." },
  { key: "x-90daysdevops", name: "90DaysOfDevOps", ...gh("MichaelCade/90DaysOfDevOps", "2026-06-24"), type: "GitHub repo", area: "Cloud & DevOps", weeks: [8, 14, 15, 19, 44, 45], categories: ["Cloud"], use: "Free community DevOps curriculum: Linux, networking, containers, Kubernetes, IaC and CI/CD in daily chunks." },
  { key: "x-devops-exercises", name: "DevOps exercises & interview questions", ...gh("bregman-arie/devops-exercises", "2025-12-27"), type: "GitHub repo", area: "Cloud & DevOps", weeks: [44, 45, 47, 48], categories: ["Cloud"], use: "Thousands of DevOps/SRE/cloud questions and exercises (AWS, Kubernetes, Terraform, Linux) — self-test after each cloud week." },
  { key: "x-k8s-hard-way", name: "Kubernetes The Hard Way (Kelsey Hightower)", ...gh("kelseyhightower/kubernetes-the-hard-way", "2025-04-09"), type: "GitHub repo", area: "Cloud & DevOps", weeks: [44], categories: ["Cloud"], use: "Bootstrap a cluster by hand to understand every component. Optional, but nothing explains Kubernetes better." },
  { key: "x-ckad-exercises", name: "CKAD exercises", ...gh("dgkanatsios/CKAD-exercises", "2026-08-18"), type: "GitHub repo", area: "Cloud & DevOps", weeks: [44], categories: ["Cloud"], use: "Hands-on kubectl drills (pods, deployments, probes, config, services) for fast Kubernetes fluency." },
  { key: "x-terraform-best-practices", name: "Terraform Best Practices (Anton Babenko)", url: "https://www.terraform-best-practices.com", repo: "antonbabenko/terraform-best-practices", lastCommit: "2026-03-20", type: "guide", area: "Cloud & DevOps", weeks: [25, 45], categories: ["Cloud"], use: "Module structure, naming, state and environment layout from a long-time Terraform maintainer." },
  { key: "x-roadmap-sh", name: "roadmap.sh — AI Engineer, DevOps and Backend roadmaps", url: "https://roadmap.sh", type: "guide", area: "Cloud & DevOps", weeks: [1, 26, 52], use: "Community skill maps. Check them at the 6-month gate and in W52 to find gaps in your own map." },

  // ── System design
  { key: "x-system-design-101", name: "System Design 101 (ByteByteGo)", ...gh("ByteByteGoHq/system-design-101", "2025-04-04"), type: "GitHub repo", area: "System design", weeks: [19, 20, 21, 22, 23], categories: ["Distributed Systems"], use: "Visual one-page explanations of caching, queues, protocols and databases — quick revision before each design case." },
  { key: "x-kps-system-design", name: "System Design course (Karan Pratap Singh)", ...gh("karanpratapsingh/system-design", "2026-07-07"), type: "GitHub repo", area: "System design", weeks: [19, 20, 21, 22], categories: ["Distributed Systems"], use: "A free, structured course from networking fundamentals to case studies — good backbone for SD-A1." },
  { key: "x-awesome-system-design", name: "Awesome System Design Resources", ...gh("ashishps1/awesome-system-design-resources", "2026-02-17"), type: "GitHub repo", area: "System design", weeks: range(19, 31), categories: ["Distributed Systems"], use: "Curated concepts, interview problems and engineering-blog articles (same author as awesome-low-level-design)." },
  { key: "x-awesome-scalability", name: "Awesome Scalability", ...gh("binhnguyennus/awesome-scalability", "2026-01-04"), type: "GitHub repo", area: "System design", weeks: [21, 22, 23, 24], categories: ["Distributed Systems", "Backend"], use: "Real engineering-blog case studies on scalability, availability and stability — cite them in design interviews." },

  // ── CS foundations
  { key: "x-pythontutor", name: "Python Tutor — visualize code execution", url: "https://pythontutor.com", type: "tool", area: "CS foundations", weeks: [2, 3], use: "Step through code and see references and mutation — the fastest way to understand the W2 mutability traps." },
  { key: "x-pro-git", name: "Pro Git (free book)", url: "https://git-scm.com/book/en/v2", type: "free book", area: "CS foundations", weeks: [8], use: "The official Git book: internals, branching and rebase in depth for the W8 Git refresh." },
  { key: "x-art-cli", name: "The Art of Command Line", ...gh("jlevy/the-art-of-command-line", "2023-07-12"), type: "GitHub repo", area: "CS foundations", weeks: [8, 16], use: "One-page command-line mastery. Stable rather than stale — the shell has not changed." },
  { key: "x-sqlbolt", name: "SQLBolt", url: "https://sqlbolt.com", type: "practice", area: "CS foundations", weeks: [6], use: "Interactive SQL lessons in the browser — a quick warm-up before Mode's tutorial." },
  { key: "x-pgexercises", name: "PostgreSQL Exercises", url: "https://pgexercises.com", type: "practice", area: "CS foundations", weeks: [7, 12, 13], use: "Realistic Postgres queries with joins, aggregates, window functions and recursive CTEs." },
  { key: "x-hpbn", name: "High Performance Browser Networking (free book)", url: "https://hpbn.co", type: "free book", area: "CS foundations", weeks: [14, 15], use: "TCP, TLS, HTTP/2, WebSocket and WebRTC performance by Ilya Grigorik — the depth behind W14–W15." },
  { key: "x-teachyourselfcs", name: "Teach Yourself Computer Science", url: "https://teachyourselfcs.com", type: "guide", area: "CS foundations", weeks: [10, 11, 12, 13, 14], use: "The best book and lecture per CS subject — use it to pick one extra source for OS, DBMS or networks." },

  // ── DSA & interviews
  { key: "x-tech-interview-handbook", name: "Tech Interview Handbook", url: "https://www.techinterviewhandbook.org", repo: "yangshun/tech-interview-handbook", lastCommit: "2026-08-07", type: "guide", area: "DSA & interviews", weeks: [18, 26, 48, 49, 50, 51], use: "Coding patterns, behavioral (STAR) prep, resume and negotiation guides — pairs with the P7 interview weeks." },
  { key: "x-grind75", name: "Grind 75 — study plan generator", url: "https://www.techinterviewhandbook.org/grind75", type: "practice", area: "DSA & interviews", weeks: [26, 43, 48, 50], use: "Time-boxed plans over the most useful LeetCode questions — use it to build unseen timed sets for the DSA gates." },
  { key: "x-coding-interview-university", name: "Coding Interview University", ...gh("jwasham/coding-interview-university", "2024-12-06"), type: "GitHub repo", area: "DSA & interviews", weeks: [9, 18, 26], use: "A complete CS study-plan checklist. Use it as a gap finder at each gate, not as a second curriculum." },
  { key: "x-visualgo", name: "VisuAlgo — animated data structures", url: "https://visualgo.net", type: "tool", area: "DSA & interviews", weeks: [10, 16, 19], use: "Animations of heaps, graphs, trees and DP — watch one before tackling a new pattern." },
  { key: "x-the-algorithms", name: "TheAlgorithms/Python", ...gh("TheAlgorithms/Python", "2026-09-23"), type: "GitHub repo", area: "DSA & interviews", weeks: [9, 26], use: "Reference implementations of classic algorithms in Python — compare after you solve, never before." },

  // ── Career
  { key: "x-negotiation", name: "Ten Rules for Negotiating a Job Offer (Haseeb Qureshi)", url: "https://haseebq.com/my-ten-rules-for-negotiating-a-job-offer/", type: "article", area: "Career", weeks: [51], use: "The most-cited practical guide to offer negotiation — read before writing docs/negotiation.md in W51." },
  { key: "x-levels-fyi", name: "Levels.fyi — compensation data", url: "https://www.levels.fyi", type: "tool", area: "Career", weeks: [51], use: "Compensation by company, level and location — ground your market bands in real data." },
];

/**
 * Two source resources are books with no link in the original HTML. The source text is kept as-is;
 * these links are added at display time (and noted in the migration audit).
 */
export const LINK_FIXES: Record<string, { url: string; note: string }> = {
  ddia: { url: "https://dataintensive.net", note: "Link added. The 2nd edition (Kleppmann & Riccomini, O'Reilly) came out in 2026." },
  alexxu: { url: "https://bytebytego.com", note: "Link added: ByteByteGo, Alex Xu's home for the book's material and newer system-design content." },
};

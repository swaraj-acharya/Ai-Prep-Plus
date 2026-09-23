import { IDX } from "@/lib/roadmap/client-index";
import { allProblemStatuses, dsaSummary } from "@/lib/dsa/engine";
import { portfolioStats } from "@/lib/projects/engine";
import type { UserState } from "./reducer";
import { checklistProgress, finalKeys, gatePassed, masteryStatus, progressOf } from "./selectors";

/**
 * Learning scoreboard: independent evidence per area, never a single blended number.
 * Each area combines mastery confirmations (capability) with completed work (effort).
 */
export interface ScoreArea { id: string; label: string; pct: number; evidence: string[] }

const masteryPct = (s: UserState, ids: string[]) => {
  const done = ids.filter((id) => masteryStatus(s, id) === "mastered").length;
  return { done, total: ids.length };
};

export function scoreboard(s: UserState, today: string): ScoreArea[] {
  const phaseTasks = (ids: string[], types?: string[]) => progressOf(s, IDX.tasks.filter((t) => ids.includes(t.phase) && (!types || types.includes(t.type))));
  const dsa = dsaSummary(allProblemStatuses(s, IDX.dsa.map((d) => d.id), today).values());
  const pf = portfolioStats(s);
  const area = (id: string, label: string, mastery: string[], work: { done: number; total: number }, extra: string[] = []): ScoreArea => {
    const m = masteryPct(s, mastery);
    const pct = Math.round(100 * (0.5 * (m.total ? m.done / m.total : 0) + 0.5 * (work.total ? work.done / work.total : 0)));
    return { id, label, pct, evidence: [`${m.done}/${m.total} mastery checkpoints confirmed`, `${work.done}/${work.total} scheduled tasks completed`, ...extra] };
  };
  const cloud = progressOf(s, IDX.tasks.filter((t) => t.type === "cloud" || t.project === "pr-ops"));
  const gates = IDX.gates.filter((g) => gatePassed(s, g.phase)).length;
  const github = checklistProgress(s, finalKeys("GitHub / portfolio ready"));
  const deploy = checklistProgress(s, finalKeys("Deployment completed"));
  const interview = checklistProgress(s, finalKeys("Interview preparation completed"));
  return [
    area("swe", "Software engineering", ["m-python", "m-os", "m-db", "m-net", "m-sd", "m-js", "m-mern", "m-mern2"], phaseTasks(["P1", "P2"])),
    area("ai", "AI engineering", ["m-llm", "m-rag", "m-agents"], phaseTasks(["P3", "P5"])),
    area("cloud", "Cloud engineering", ["m-devops"], cloud),
    area("ml", "Machine learning", ["m-data", "m-ml", "m-dl", "m-ft"], phaseTasks(["P4"])),
    area("mlops", "MLOps", ["m-mlops"], phaseTasks(["P6"])),
    { id: "dsa", label: "DSA", pct: Math.round((100 * (dsa.solved + dsa.coldSolved)) / (2 * IDX.dsa.length)), evidence: [`${dsa.solved}/${IDX.dsa.length} solved`, `${dsa.coldSolved} solved cold`, `${dsa.retained} fully retained`, `${dsa.revisionsCompleted} spaced revisions completed`] },
    { id: "projects", label: "Projects", pct: Math.min(100, Math.round((100 * pf.completed) / 20)), evidence: [`${pf.completed} completed (${pf.roadmapProjectsDone} roadmap, ${pf.completed - pf.roadmapProjectsDone} Lab)`, `${pf.flagshipsCompleted} Lab flagships`, `${pf.started} started`] },
    { id: "deploy", label: "Deployment", pct: Math.round((100 * (deploy.done + Math.min(pf.liveDemos, 4))) / (deploy.total + 4)), evidence: [`${pf.liveDemos} live demos linked`, `${deploy.done}/${deploy.total} deployment readiness items`] },
    { id: "oss", label: "Open source & public proof", pct: Math.round((100 * (github.done + Math.min(pf.writeups + pf.postmortems, 4) + Math.min(Object.keys(s.syncs).length, 1))) / (github.total + 5)), evidence: [`${pf.writeups} technical write-ups`, `${pf.postmortems} postmortems`, `${Object.keys(s.syncs).length} GitHub learning-journal syncs`, `${github.done}/${github.total} portfolio items`] },
    { id: "interview", label: "Interview preparation", pct: Math.round((100 * (interview.done + gates + (masteryStatus(s, "m-interview") === "mastered" ? 1 : 0))) / (interview.total + IDX.gates.length + 1)), evidence: [`${gates}/${IDX.gates.length} phase gates passed`, `${interview.done}/${interview.total} interview readiness items`] },
  ];
}

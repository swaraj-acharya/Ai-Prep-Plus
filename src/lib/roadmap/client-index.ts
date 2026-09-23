import raw from "@/data/generated/task-index.json";
import type { Priority, TaskIndex, TaskType } from "./types";

/** Lightweight roadmap index safe to ship to the browser (no task text). */
export interface IndexedTask {
  id: string; order: number; dayIdx: number; week: number; day: number; absDay: number; phase: string;
  type: TaskType; priority: Priority; minutes: number; auto: boolean; supporting: boolean; project?: string; problemIds: string[];
}
export interface IndexedDay { idx: number; week: number; day: number; absDay: number; phase: string; title: string; minutes: number; taskIds: string[] }

const data = raw as unknown as TaskIndex;

function build() {
  const weekPhase = new Map(data.weeks.map((w) => [w.n, w.phase]));
  const days: IndexedDay[] = data.days.map((d) => ({ idx: d.i, week: d.w, day: d.d, absDay: d.a, phase: weekPhase.get(d.w)!, title: d.t, minutes: d.m, taskIds: [] }));
  const tasks: IndexedTask[] = data.tasks.map(([id, dayIdx, type, priority, minutes, flags, project, problemIds], order) => {
    const d = days[dayIdx];
    d.taskIds.push(id);
    return {
      id, order, dayIdx, week: d.week, day: d.day, absDay: d.absDay, phase: d.phase, type, priority, minutes,
      auto: (flags & 1) === 1, supporting: (flags & 2) === 2, project: project || undefined, problemIds: problemIds ? problemIds.split(",") : [],
    };
  });
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const byWeek = new Map<number, IndexedTask[]>();
  const byPhase = new Map<string, IndexedTask[]>();
  for (const t of tasks) {
    (byWeek.get(t.week) ?? byWeek.set(t.week, []).get(t.week)!).push(t);
    (byPhase.get(t.phase) ?? byPhase.set(t.phase, []).get(t.phase)!).push(t);
  }
  return {
    version: data.version,
    contentHash: data.contentHash,
    phases: data.phases,
    weeks: data.weeks,
    days,
    tasks,
    byId,
    weekTasks: (n: number) => byWeek.get(n) ?? [],
    phaseTasks: (id: string) => byPhase.get(id) ?? [],
    dayTasks: (idx: number) => (days[idx]?.taskIds ?? []).map((id) => byId.get(id)!),
    gates: data.gates,
    mastery: data.mastery,
    dsa: data.dsa,
    existingProjects: data.existingProjects,
    sideTracks: data.sideTracks,
    finalReadiness: data.finalReadiness,
    phaseOfWeek: (n: number) => weekPhase.get(n)!,
  };
}

export type RoadmapIndex = ReturnType<typeof build>;
export const IDX: RoadmapIndex = build();

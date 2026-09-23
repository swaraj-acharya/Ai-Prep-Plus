import type { Metadata } from "next";
import { RoadmapView } from "@/components/views/roadmap";
import { COPY, ROADMAP } from "@/lib/roadmap/server";

export const metadata: Metadata = { title: "Roadmap" };
export default function Page() {
  return <RoadmapView phases={ROADMAP.phases} weeks={ROADMAP.weeks.map((w) => ({ n: w.n, phase: w.phase, title: w.title, objective: w.objective, hours: w.hours }))} gates={ROADMAP.assessments.map((a) => ({ phase: a.phase, week: a.week, title: a.title }))} note={COPY.roadmap.certsNote} />;
}

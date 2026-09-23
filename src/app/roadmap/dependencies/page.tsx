import type { Metadata } from "next";
import { DependencyMap } from "@/components/views/roadmap";
import { COPY, ROADMAP } from "@/lib/roadmap/server";

export const metadata: Metadata = { title: "Dependency map" };
export default function Page() {
  return <DependencyMap nodes={ROADMAP.dependencies.nodes} edges={ROADMAP.dependencies.edges} help={COPY.roadmap.depsHelp} phases={ROADMAP.phases.map((p) => ({ id: p.id, name: p.name }))} />;
}

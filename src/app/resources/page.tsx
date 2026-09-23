import type { Metadata } from "next";
import { ResourcesView } from "@/components/views/learning";
import { COPY, ROADMAP } from "@/lib/roadmap/server";
import { withLinkFixes } from "@/lib/resources";

export const metadata: Metadata = { title: "Resources" };
export default function Page() {
  return <ResourcesView resources={withLinkFixes(ROADMAP.resources)} lead={COPY.resourcesLead} />;
}

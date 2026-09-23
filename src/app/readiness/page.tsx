import type { Metadata } from "next";
import { ReadinessView } from "@/components/views/static";
import { COPY, ROADMAP } from "@/lib/roadmap/server";

export const metadata: Metadata = { title: "Final readiness" };
export default function Page() {
  return <ReadinessView groups={ROADMAP.finalReadiness} lead={COPY.finalLead} />;
}

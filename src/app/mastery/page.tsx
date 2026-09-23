import type { Metadata } from "next";
import { MasteryView } from "@/components/views/learning";
import { COPY, ROADMAP } from "@/lib/roadmap/server";

export const metadata: Metadata = { title: "Mastery" };
export default function Page() {
  return <MasteryView items={ROADMAP.mastery} lead={COPY.revision.masteryLead} />;
}

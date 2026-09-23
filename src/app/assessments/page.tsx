import type { Metadata } from "next";
import { AssessmentsView } from "@/components/views/learning";
import { COPY, ROADMAP } from "@/lib/roadmap/server";

export const metadata: Metadata = { title: "Phase gates" };
export default function Page() {
  return <AssessmentsView gates={ROADMAP.assessments} lead={COPY.assessLead} />;
}

import type { Metadata } from "next";
import { RevisionView } from "@/components/views/learning";
import { COPY } from "@/lib/roadmap/server";

export const metadata: Metadata = { title: "Revision" };
export default function Page() {
  return <RevisionView howItWorks={COPY.revision.howItWorks} />;
}

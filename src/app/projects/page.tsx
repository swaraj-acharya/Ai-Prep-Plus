import type { Metadata } from "next";
import { ProjectLabView } from "@/components/views/projects";
import { COPY } from "@/lib/roadmap/server";

export const metadata: Metadata = { title: "Project Lab" };
export default function Page() {
  return <ProjectLabView lead={COPY.projectsLead} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExistingProjectDetail, LabProjectDetail } from "@/components/views/projects";
import { LAB_BY_ID, LAB_BY_SLUG, LAB_PROJECTS } from "@/data/projects/lab";
import { getExistingProject, getTask, ROADMAP } from "@/lib/roadmap/server";

const resolve = (slug: string) => LAB_BY_SLUG.get(slug) ?? LAB_BY_ID.get(slug);

export function generateStaticParams() {
  return [...LAB_PROJECTS.map((p) => ({ slug: p.slug })), ...ROADMAP.existingProjects.map((p) => ({ slug: p.id }))];
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: resolve(slug)?.name ?? getExistingProject(slug)?.shortName ?? "Project" };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lab = resolve(slug);
  if (lab) return <LabProjectDetail id={lab.id} />;
  const ex = getExistingProject(slug);
  if (!ex) notFound();
  const tasks = ex.scheduledTaskIds.map((id) => getTask(id)!).filter(Boolean).map((t) => ({ id: t.id, week: t.week, day: t.day, head: t.text.split(/(?<=\.)\s/)[0].slice(0, 140) }));
  return <ExistingProjectDetail p={ex} tasks={tasks} />;
}

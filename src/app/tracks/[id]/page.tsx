import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrackView } from "@/components/views/static";
import { COPY, getSideTrack, ROADMAP } from "@/lib/roadmap/server";

export function generateStaticParams() {
  return ROADMAP.sideTracks.map((t) => ({ id: t.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: getSideTrack((await params).id)?.name ?? "Track" };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const t = getSideTrack((await params).id);
  if (!t) notFound();
  return <TrackView track={t} lead={COPY.sideLead} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WeekView } from "@/components/views/week";
import { getWeek } from "@/lib/roadmap/server";

export function generateStaticParams() {
  return Array.from({ length: 52 }, (_, i) => ({ week: String(i + 1) }));
}
export async function generateMetadata({ params }: { params: Promise<{ week: string }> }): Promise<Metadata> {
  const w = getWeek(Number((await params).week));
  return { title: w ? `Week ${w.n} — ${w.title}` : "Week" };
}
export default async function Page({ params, searchParams }: { params: Promise<{ week: string }>; searchParams: Promise<{ task?: string; tab?: string }> }) {
  const n = Number((await params).week);
  if (!Number.isInteger(n) || !getWeek(n)) notFound();
  const sp = await searchParams;
  return <WeekView n={n} highlightTask={typeof sp.task === "string" ? sp.task : undefined} defaultTab={sp.tab === "review" ? "review" : sp.tab === "details" ? "details" : "plan"} />;
}

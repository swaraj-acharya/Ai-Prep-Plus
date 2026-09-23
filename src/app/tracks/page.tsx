import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { COPY, ROADMAP } from "@/lib/roadmap/server";

export const metadata: Metadata = { title: "Special tracks" };
export default function Page() {
  return (
    <>
      <PageHeader title="Special tracks" lead={COPY.sideLead} />
      <ul className="grid gap-3 md:grid-cols-3">
        {ROADMAP.sideTracks.map((t) => (
          <li key={t.id}>
            <Link href={`/tracks/${t.id}`} className="block rounded-lg border border-line bg-surface p-4 hover:border-line-strong">
              <div className="font-medium">
                {t.emoji} {t.name}
              </div>
              <div className="mt-1 text-sm text-muted">{t.modules.length} modules · {t.hours}</div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

import type { Metadata } from "next";
import { Badge, PageHeader } from "@/components/ui";
import { COPY, ROADMAP } from "@/lib/roadmap/server";

export const metadata: Metadata = { title: "Certifications" };
export default function Page() {
  return (
    <>
      <PageHeader title="Certifications" lead={COPY.roadmap.certsNote} />
      <ul className="space-y-3">
        {ROADMAP.certifications.map((c) => (
          <li key={c.name} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{c.name}</span>
              <Badge tone={/core/i.test(c.status) ? "accent" : "neutral"}>{c.status}</Badge>
              <Badge>{c.when}</Badge>
              <Badge>{c.cost}</Badge>
            </div>
            <p className="mt-1.5 text-sm text-muted">{c.why}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

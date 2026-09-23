import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { COPY, ROADMAP } from "@/lib/roadmap/server";

export const metadata: Metadata = { title: "Horizon" };
export default function Page() {
  return (
    <>
      <PageHeader title="Horizon — year 2 and beyond" lead={COPY.roadmap.horizonNote} />
      <div className="grid gap-4 md:grid-cols-2">
        {ROADMAP.horizon.map((h) => (
          <Card key={h.title} title={h.title}>
            <p className="text-sm">{h.text}</p>
          </Card>
        ))}
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { COPY, ROADMAP } from "@/lib/roadmap/server";

export const metadata: Metadata = { title: "Career blueprint" };
export default function Page() {
  const b = ROADMAP.careerBlueprint;
  const c = COPY.blueprint;
  return (
    <>
      <PageHeader title={b.title} lead={b.northStar} />
      <p className="mb-5 max-w-3xl text-sm text-muted">{c.howToUse}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Skill pillars" className="md:col-span-2">
          <ul className="grid gap-3 md:grid-cols-2">
            {b.skillPillars.map(([n, name, what]) => (
              <li key={n} className="text-sm">
                <span className="mr-2 font-mono text-xs text-accent">{n}</span>
                <span className="font-medium">{name}</span>
                <div className="mt-0.5 text-muted">{what}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Career spine" className="md:col-span-2">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Weeks</th>
                  <th className="py-1.5 pr-3 font-medium">Focus</th>
                  <th className="py-1.5 pr-3 font-medium">Cloud</th>
                  <th className="py-1.5 font-medium">Proof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {c.careerSpine.map((r) => (
                  <tr key={r.weeks}>
                    <td className="py-2 pr-3 font-mono text-xs">{r.weeks}</td>
                    <td className="py-2 pr-3">{r.focus}</td>
                    <td className="py-2 pr-3 text-muted">{r.cloud}</td>
                    <td className="py-2">{r.proof}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={c.rule1Title}>
          <p className="text-sm">{b.proofRule}</p>
        </Card>
        <Card title={c.rule2Title}>
          <p className="text-sm">{c.rule2}</p>
        </Card>
        <Card title="Weekly allocation">
          <p className="text-sm">{b.weeklyAllocation}</p>
          <p className="mt-2 text-xs text-muted">{c.allocationNote}</p>
        </Card>
        <Card title="Certification ladder">
          <p className="text-sm">{b.certLadder}</p>
          <p className="mt-2 text-xs text-muted">{c.certNote}</p>
        </Card>
        <Card title="Non-goals">
          <ul className="list-disc space-y-1 pl-4 text-sm">
            {b.nonGoals.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Card>
        <Card title="Year 2">
          <p className="text-sm">{b.year2}</p>
        </Card>
      </div>
    </>
  );
}

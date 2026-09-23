"use client";
import { useEffect, useState } from "react";
import { Button, LinkButton, Modal } from "@/components/ui";
import { useLearning } from "@/lib/client/store";
import { IDX } from "@/lib/roadmap/client-index";
import { currentDayIdx, gapSinceLastActivity } from "@/lib/state/selectors";
import { allProblemStatuses, dsaSummary } from "@/lib/dsa/engine";

/** Source behaviour: after ≥ 2 days away show a welcome-back summary; offer Recovery Mode after ≥ 3. */
export function WelcomeBack() {
  const hydrated = useLearning((s) => s.hydrated);
  const [info, setInfo] = useState<{ gap: number; where: string; due: number } | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const { state, today } = useLearning.getState();
    const t = today();
    if (sessionStorage.getItem("pb_welcome") === t) return;
    const gap = gapSinceLastActivity(state, t);
    if (gap === null || gap < 2) return;
    const d = IDX.days[currentDayIdx(state)];
    const due = dsaSummary(allProblemStatuses(state, IDX.dsa.map((x) => x.id), t).values()).revisionDue;
    setInfo({ gap, where: `Week ${d.week}, day ${d.day} — ${d.title}`, due });
    sessionStorage.setItem("pb_welcome", t);
  }, [hydrated]);
  if (!info) return null;
  return (
    <Modal open onOpenChange={(v) => !v && setInfo(null)} title="Welcome back" description={`Your last recorded study day was ${info.gap} days ago. Your position hasn't moved — the roadmap waits for you.`}>
      <div className="space-y-2 text-sm">
        <p>
          <span className="text-muted">Pick up at:</span> {info.where}
        </p>
        {info.due > 0 && (
          <p>
            <span className="text-muted">DSA revisions due:</span> {info.due}
          </p>
        )}
        {info.gap >= 3 && <p className="text-muted">After a longer break, Recovery Mode tells you what to keep, compress and postpone so you catch up without burning out.</p>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton href="/today" variant="primary">
          Open today
        </LinkButton>
        {info.gap >= 3 && <LinkButton href="/recovery">Recovery mode</LinkButton>}
        <Button variant="ghost" onClick={() => setInfo(null)}>
          Dismiss
        </Button>
      </div>
    </Modal>
  );
}

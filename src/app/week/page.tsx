"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loading } from "@/components/domain";
import { WeekView } from "@/components/views/week";
import { useDerived, useLS } from "@/lib/client/hooks";
import { IDX } from "@/lib/roadmap/client-index";
import { currentDayIdx } from "@/lib/state/selectors";

function CurrentWeek() {
  const { hydrated } = useLS();
  const sp = useSearchParams();
  const week = useDerived((s) => IDX.days[currentDayIdx(s)].week);
  if (!hydrated) return <Loading />;
  return <WeekView n={week} defaultTab={sp.get("tab") === "review" ? "review" : "plan"} />;
}
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <CurrentWeek />
    </Suspense>
  );
}

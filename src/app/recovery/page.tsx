import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { RecoveryPanel } from "@/components/views/static";
import { COPY, ROADMAP } from "@/lib/roadmap/server";

export const metadata: Metadata = { title: "Recovery mode" };
export default function Page() {
  return (
    <>
      <PageHeader title="Recovery mode" lead={COPY.recoveryLead} />
      <RecoveryPanel recovery={ROADMAP.recovery} />
    </>
  );
}

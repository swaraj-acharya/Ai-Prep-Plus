import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/domain";
import { DsaView } from "@/components/views/dsa";
import { COPY } from "@/lib/roadmap/server";

export const metadata: Metadata = { title: "DSA" };
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <DsaView note={COPY.b75Note} />
    </Suspense>
  );
}

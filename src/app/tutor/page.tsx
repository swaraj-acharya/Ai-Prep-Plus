import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/domain";
import { TutorView } from "@/components/views/tutor";
import { COPY, PROMPTS } from "@/lib/roadmap/server";

export const metadata: Metadata = { title: "Study with Claude" };
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <TutorView prompts={PROMPTS} copy={COPY.tutor} />
    </Suspense>
  );
}

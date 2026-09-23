import type { Metadata } from "next";
import { TodayView } from "@/components/views/today";
import { COPY } from "@/lib/roadmap/server";

export const metadata: Metadata = { title: "Today" };
export default function Page() {
  return <TodayView gateWarning={COPY.gateWarning} dayComplete={COPY.dayComplete} />;
}

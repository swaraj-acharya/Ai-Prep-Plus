import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/domain";
import { SettingsView } from "@/components/views/settings";

export const metadata: Metadata = { title: "Settings" };
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <SettingsView />
    </Suspense>
  );
}

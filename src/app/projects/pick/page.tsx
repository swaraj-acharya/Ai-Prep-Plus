import type { Metadata } from "next";
import { PickerView } from "@/components/views/projects";

export const metadata: Metadata = { title: "What should I build?" };
export default function Page() {
  return <PickerView />;
}

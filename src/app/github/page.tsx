import type { Metadata } from "next";
import { GithubView } from "@/components/views/github";

export const metadata: Metadata = { title: "Save progress to GitHub" };
export default function Page() {
  return <GithubView />;
}

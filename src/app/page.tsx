import { Dashboard } from "@/components/views/dashboard";
import { COPY } from "@/lib/roadmap/server";

export default function Page() {
  return <Dashboard tips={COPY.dashboardTips} dailyLoop={COPY.dailyLoop} />;
}

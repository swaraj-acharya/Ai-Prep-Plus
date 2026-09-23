"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useLearning } from "@/lib/client/store";

export function Providers({ children }: { children: React.ReactNode }) {
  const init = useLearning((s) => s.init);
  const path = usePathname();
  useEffect(() => {
    if (path === "/login") return;
    void init();
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, [init, path]);
  return <>{children}</>;
}

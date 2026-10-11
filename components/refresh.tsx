"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function DashboardRefresh() {
  const router = useRouter();
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60000);
    return () => clearInterval(interval);
  }, [router]);
  return (
    <span className="refresh-note">Atualização automática a cada minuto</span>
  );
}

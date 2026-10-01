"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-renders the page from the server every few seconds while `active` (e.g. a run still going); opened details stay open.
export function AutoRefresh({ active, intervalMs = 3000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) {
      return;
    }

    const timer = setInterval(() => router.refresh(), intervalMs);

    return () => clearInterval(timer);
  }, [active, intervalMs, router]);

  return active ? <span className="chip">live: updates every {Math.round(intervalMs / 1000)} s</span> : null;
}

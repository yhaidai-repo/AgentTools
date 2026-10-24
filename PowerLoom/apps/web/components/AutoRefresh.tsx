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

  // A refresh time would only tick like a clock (user, 2026-10-18): the mark says "Live", the period is in its tooltip.
  return active ? <span className="live" title={`Refreshes every ${Math.round(intervalMs / 1000)} s`}>Live</span> : null;
}

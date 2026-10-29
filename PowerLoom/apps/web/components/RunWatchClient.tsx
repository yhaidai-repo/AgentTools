"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const POLL_MS = 5000;

// Re-renders the page once when a run starts or ends in the vault, and only then: it asks for the ids of the runs in
// progress and compares them with the ones the page was drawn with. Quiet while the tab is hidden.
export function RunWatchClient({ drawnWith }: { drawnWith: number[] }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => refreshWhenRunsChanged(drawnWith, () => router.refresh()), POLL_MS);

    return () => clearInterval(timer);
  }, [drawnWith, router]);

  return null;
}

async function refreshWhenRunsChanged(drawnWith: number[], refresh: () => void): Promise<void> {
  if (document.visibilityState !== "visible") {
    return;
  }

  const current = await fetchRunningIds();

  if (current !== null && current.join(",") !== drawnWith.join(",")) {
    refresh();
  }
}

async function fetchRunningIds(): Promise<number[] | null> {
  try {
    const response = await fetch("/api/running-runs", { cache: "no-store" });

    return response.ok ? ((await response.json()) as { ids: number[] }).ids : null;
  } catch {
    return null;
  }
}

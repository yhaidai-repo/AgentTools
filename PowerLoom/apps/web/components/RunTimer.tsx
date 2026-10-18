"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";

const TICK_MS = 1000;

// How long the run has been going, counted in the browser every second.
export function RunTimer({ since }: { since: Date }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);

    return () => clearInterval(timer);
  }, []);

  return <span className="running-time" suppressHydrationWarning>{formatDuration(Math.max(now - new Date(since).getTime(), 0))}</span>;
}

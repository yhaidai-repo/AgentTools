"use client";

import { formatAge } from "@/lib/format";

// "in 1h 28m" style: how long until a moment, counted in the viewer's browser; the exact local time shows on hover.
export function TimeUntil({ date }: { date: Date | string | null }) {
  if (!date) {
    return <>–</>;
  }

  const value = new Date(date);
  const left = value.getTime() - Date.now();

  return <time dateTime={value.toISOString()} title={value.toLocaleString()} suppressHydrationWarning>{left > 0 ? `in ${formatAge(left)}` : "now"}</time>;
}

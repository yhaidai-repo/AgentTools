"use client";

import { formatAge } from "@/lib/format";

// "3d ago", counted in the viewer's browser; the exact local time shows on hover.
export function TimeAgo({ date }: { date: Date | string | null }) {
  if (!date) {
    return <>–</>;
  }

  const value = new Date(date);

  return <time dateTime={value.toISOString()} title={value.toLocaleString()} suppressHydrationWarning>{formatAge(Date.now() - value.getTime())} ago</time>;
}

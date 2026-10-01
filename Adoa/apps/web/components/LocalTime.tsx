"use client";

// Formats in the viewer's time zone; the server (container) runs in UTC.
export function LocalTime({ date, timeOnly = false }: { date: Date | string | null; timeOnly?: boolean }) {
  if (!date) {
    return <>–</>;
  }

  const value = new Date(date);

  return <time dateTime={value.toISOString()} suppressHydrationWarning>{timeOnly ? value.toLocaleTimeString() : value.toLocaleString()}</time>;
}

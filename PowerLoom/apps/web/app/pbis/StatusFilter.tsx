"use client";

import { usePathname, useRouter } from "next/navigation";

// Several statuses at once (user request 2026-10-13), applied on each change; the choice lives in the URL as
// `status=a,b`, so the remembered filters keep it.
export function StatusFilter({ selected, statuses }: { selected: string[]; statuses: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const apply = (next: string[]) => router.push(next.length > 0 ? `${pathname}?status=${next.join(",")}` : `${pathname}?status=`);
  const toggle = (status: string) => apply(selected.includes(status) ? selected.filter((value) => value !== status) : statuses.filter((value) => value === status || selected.includes(value)));

  return (
    <div className="toolbar filters">
      <label>Status</label>
      <details className="multi-select">
        <summary>{selected.length > 0 ? selected.join(", ") : "All"}</summary>
        <ul>
          <li><label><input type="checkbox" checked={selected.length === 0} onChange={() => apply([])} /> All</label></li>
          {statuses.map((status) => (
            <li key={status}><label><input type="checkbox" checked={selected.includes(status)} onChange={() => toggle(status)} /> {status}</label></li>
          ))}
        </ul>
      </details>
    </div>
  );
}

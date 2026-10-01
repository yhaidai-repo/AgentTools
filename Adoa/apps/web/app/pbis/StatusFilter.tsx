"use client";

// Applies on change: the status lives in the URL, no Filter button.
export function StatusFilter({ status, statuses }: { status: string; statuses: string[] }) {
  return (
    <form method="get" className="toolbar filters">
      <label>
        Status
        <select name="status" defaultValue={status} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
          <option value="">All</option>
          {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
    </form>
  );
}

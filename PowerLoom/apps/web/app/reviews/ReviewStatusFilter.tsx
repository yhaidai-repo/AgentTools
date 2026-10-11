"use client";

// Applies on change: the filter lives in the URL, no Filter button. It sits in the page's toolbar next to "Check now",
// so it takes no toolbar margin of its own.
export function ReviewStatusFilter({ status, statuses }: { status: string; statuses: readonly string[] }) {
  return (
    <form method="get" className="actions filters">
      <label>
        Reviews
        <select name="status" defaultValue={status} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
          {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
    </form>
  );
}

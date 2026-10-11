"use client";

// Applies on change: the period lives in the URL, no Show button.
export function RangeFilter({ range, ranges }: { range: string; ranges: { key: string; label: string }[] }) {
  return (
    <form method="get" className="toolbar filters">
      <label>
        Period
        <select name="range" defaultValue={range} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
          {ranges.map(({ key, label }) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </label>
    </form>
  );
}

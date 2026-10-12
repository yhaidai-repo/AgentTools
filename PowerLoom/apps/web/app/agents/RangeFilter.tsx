"use client";

interface RangeFilterProps {
  range: string;
  ranges: { key: string; label: string }[];
  /** Other URL parameters the page needs, kept through the change (e.g. the dashboard's tab). */
  keep?: Record<string, string>;
}

// Applies on change: the period lives in the URL, no Show button.
export function RangeFilter({ range, ranges, keep = {} }: RangeFilterProps) {
  return (
    <form method="get" className="toolbar filters">
      {Object.entries(keep).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
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

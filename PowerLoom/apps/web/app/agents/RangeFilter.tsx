"use client";

interface RangeFilterProps {
  range: string;
  ranges: { key: string; label: string }[];
  /** Other URL parameters the page needs, kept through the change (e.g. the dashboard's tab). */
  keep?: Record<string, string>;
  /** The URL parameter and its label; a period by default, but any one-of choice works (e.g. a sprint). */
  name?: string;
  label?: string;
}

// Applies on change: the choice lives in the URL, no Show button.
export function RangeFilter({ range, ranges, keep = {}, name = "range", label = "Period" }: RangeFilterProps) {
  return (
    <form method="get" className="toolbar filters">
      {Object.entries(keep).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <label>
        {label}
        <select name={name} defaultValue={range} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
          {ranges.map(({ key, label }) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </label>
    </form>
  );
}

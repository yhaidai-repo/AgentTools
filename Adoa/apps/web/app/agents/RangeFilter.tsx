import { RANGES } from "@/lib/ranges";

export function RangeFilter({ range }: { range: string }) {
  return (
    <form method="get" className="toolbar filters">
      <label>
        Period
        <select name="range" defaultValue={range}>
          {Object.entries(RANGES).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="secondary">Show</button>
    </form>
  );
}

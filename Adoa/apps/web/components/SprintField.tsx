import type { SprintOption } from "@/models/SprintOption";

// Falls back to a text field when ADO can't list the team's sprints. current: the sprint the last sync found current.
export function SprintField({ value, options, current = null }: { value: string; options: SprintOption[] | null; current?: string | null }) {
  if (!options) {
    return <input name="sprint" defaultValue={value} placeholder="current or AA\2026\26.3.7" required />;
  }

  return (
    <select name="sprint" defaultValue={value}>
      <option value="current">Current sprint{current ? `: ${current}` : " (from ADO)"}</option>
      {options.map((option) => (
        <option key={option.path} value={option.path}>{option.label}</option>
      ))}
    </select>
  );
}

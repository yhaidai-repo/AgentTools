import { FormPicker } from "@/components/FormPicker";
import type { SprintOption } from "@/models/SprintOption";

// The shared dropdown (user, 2026-10-18: no unstyled system lists); a text field when ADO can't list the team's sprints.
// current: the sprint the last sync found current.
export function SprintField({ value, options, current = null }: { value: string; options: SprintOption[] | null; current?: string | null }) {
  if (!options) {
    return <input name="sprint" defaultValue={value} placeholder="current or ZZ\2026\26.3.7" required />;
  }

  const choices = [{ value: "current", label: "Current sprint", note: current ?? "from ADO" }, ...options.map((option) => ({ value: option.path, label: option.label }))];

  return <FormPicker name="sprint" label="Sprint" value={value} options={choices} />;
}

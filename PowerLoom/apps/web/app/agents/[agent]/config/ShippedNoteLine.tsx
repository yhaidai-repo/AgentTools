import type { ShippedNote } from "@agenttools/config";
import { LocalTime } from "@/components/LocalTime";

const FIELD_NAMES: Record<string, string> = {
  label: "name",
  description: "description",
  prompt: "prompt",
  skills: "skills",
  canAssign: "task types it creates",
  handles: "task types it takes",
  waitFor: "checks it waits for",
};

// A system agent runs on what the code ships: the latest start that put shipped values over stored ones says so here,
// so an edit that gave way to an upgrade isn't a mystery. Edited prompts stay among the earlier versions.
export function ShippedNoteLine({ note }: { note: ShippedNote | undefined }) {
  if (!note) {
    return null;
  }

  const fields = note.fields.map((field) => FIELD_NAMES[field] ?? field).join(", ");

  return (
    <p className="field-hint">
      An upgrade on <LocalTime date={note.at} /> brought the shipped {fields}; the stored ones gave way. An edited prompt
      stays among its earlier versions.
    </p>
  );
}

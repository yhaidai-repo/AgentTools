import type { ActionResult } from "./ActionResult";
import type { TaskFormValues } from "./TaskFormValues";

// A task or schedule save: a refusal hands back what was typed, so the form shows it again instead of clearing it.
export interface TaskActionResult extends ActionResult {
  values: TaskFormValues | null;
}

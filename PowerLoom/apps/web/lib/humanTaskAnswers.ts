import { isHumanTaskData } from "@powerloom/core";
import type { localItem } from "@powerloom/db";
import { formText } from "./formFields";

// A structured human task's per-step answers (fields `answer:<n>`), one per step, "" where the step was left empty;
// other items have none.
export function answersFromForm(item: typeof localItem.$inferSelect, form: FormData): string[] {
  if (!isHumanTaskData(item.data)) {
    return [];
  }

  return item.data.steps.map((_, index) => formText(form, `answer:${index}`) ?? "");
}

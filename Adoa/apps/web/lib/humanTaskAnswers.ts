import { humanTaskResolution, isHumanTaskData } from "@adoa/core";
import type { localItem } from "@adoa/db";
import { formText } from "./formFields";

// A structured human task's per-step answers (fields `answer:<n>`) plus the note, as one markdown resolution; other items
// keep the note as their answer.
export function resolutionFromForm(item: typeof localItem.$inferSelect, form: FormData, note: string | null): string | null {
  if (!isHumanTaskData(item.data)) {
    return note;
  }

  const answers = item.data.steps.map((_, index) => formText(form, `answer:${index}`) ?? "");

  return humanTaskResolution(item.data, answers, note);
}

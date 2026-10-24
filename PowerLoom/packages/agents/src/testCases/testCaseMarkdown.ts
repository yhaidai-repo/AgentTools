import type { TestStep } from "@powerloom/ado";
import { htmlToMarkdown } from "@powerloom/vault";
import type { TestStepEntry } from "../models/TestStepEntry";

// The steps as a numbered list: the action, then the expected result indented under it. A Shared Steps item is expanded
// in place (user decision 2026-10-13), its steps marked with its id; one ADO no longer returns is named, not dropped.
export function stepsMarkdown(steps: TestStep[], sharedSteps: Map<number, TestStep[]>): string {
  const entries = steps.flatMap((step) => (step.kind === "step" ? [ownEntry(step, null)] : sharedEntries(step.sharedStepsId, sharedSteps)));

  return entries.map((entry, index) => entryMarkdown(index + 1, entry)).join("\n") || "(no steps)";
}

function ownEntry(step: TestStep, sharedStepsId: number | null): TestStepEntry {
  return step.kind === "step" ? { action: step.action, expected: step.expected, sharedStepsId } : { missingSharedStepsId: step.sharedStepsId };
}

// Shared Steps hold own steps only (ADO doesn't nest them).
function sharedEntries(sharedStepsId: number, sharedSteps: Map<number, TestStep[]>): TestStepEntry[] {
  const steps = sharedSteps.get(sharedStepsId);

  if (!steps) {
    return [{ missingSharedStepsId: sharedStepsId }];
  }

  return steps.filter((step) => step.kind === "step").map((step) => ownEntry(step, sharedStepsId));
}

function entryMarkdown(number: number, entry: TestStepEntry): string {
  if ("missingSharedStepsId" in entry) {
    return `${number}. (Shared Steps ${entry.missingSharedStepsId}: not readable in Azure DevOps)`;
  }

  const shared = entry.sharedStepsId === null ? "" : ` _(shared steps ${entry.sharedStepsId})_`;
  const expected = htmlToMarkdown(entry.expected);
  const action = `${number}. ${indent(htmlToMarkdown(entry.action) || "(no action)")}${shared}`;

  return expected ? `${action}\n   Expected: ${indent(expected)}` : action;
}

// Continuation lines stay inside their list item.
function indent(text: string): string {
  return text.replaceAll("\n", "\n   ");
}

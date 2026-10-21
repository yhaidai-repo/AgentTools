import type { ChildBug } from "./models/ChildBug";

// Long repro steps are cut: the full bug is one read_pbi away, and the message stays small with many bugs.
const MAX_STEPS_CHARS = 1500;

// The PBI's bugs as the run retests them: each becomes a case with ref PBI-<id>, unless a planned case already
// covers it (the failed case that reported it).
export function childBugsBlock(bugs: ChildBug[]): string {
  if (bugs.length === 0) {
    return "";
  }

  return [
    "<bugs-to-retest>",
    "The PBI's bugs. Retest each one: a case with ref PBI-<id>, the bug's steps and its expected result, run like any case; pass = fixed, fail = still failing (the result's bug is PBI-<id>, no new report_bug). A bug a planned case already proves (the case that reported it) needs no second case: name the bug on that case's result.",
    ...bugs.map(bugLines),
    "</bugs-to-retest>",
  ].join("\n");
}

function bugLines(bug: ChildBug): string {
  return [`- PBI-${bug.adoId} (${bug.adoState}): ${bug.title}`, `  Steps: ${stepsText(bug.steps)}`].join("\n");
}

function stepsText(steps: string | null): string {
  if (!steps?.trim()) {
    return "none written: read_pbi it, or write the steps from its title and say so";
  }

  const oneLine = steps.trim().replace(/\s*\n\s*/g, " / ");
  const cut = oneLine.length > MAX_STEPS_CHARS ? ` … [cut, read_pbi for the rest]` : "";

  return `${oneLine.slice(0, MAX_STEPS_CHARS)}${cut}`;
}

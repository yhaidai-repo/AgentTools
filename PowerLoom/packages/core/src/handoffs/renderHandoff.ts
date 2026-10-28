import type { HandoffRefs } from "@powerloom/db";
import { renderHumanTaskBody } from "../humanTasks";
import type { HandoffContext } from "../models/HandoffContext";
import type { HandoffView } from "../models/HandoffView";
import type { HumanTaskData } from "../models/HumanTaskData";
import type { NewHandoff } from "../models/NewHandoff";
import type { PreviousResult } from "../models/PreviousResult";

const INTENT_LINES: Record<NewHandoff["intent"], string> = {
  continue: "carry the work on from here",
  ask: "answer this; the sender waits for it and runs again",
  review: "review the sender's output; the tasks after it wait for your decision",
  return: "take the work back and redo what it names",
};

// The one hand-off renderer (user decision 2026-10-28): what the receiving agent reads first, the human task's body and
// the Continue chat's section are all rendered here, so an agent and a person see the same package.

/** (a) The receiving agent's first block: the hand-offs that created its task, the outcomes of the hand-offs it waits
 *  for, then its own previous result. Empty when there is none of them. */
export function handoffContextBlock(context: HandoffContext): string {
  const parts = [...context.incoming.map(incomingElement), ...context.dependencies.map(outcomeElement), ...previousElement(context.previous)];

  return parts.length > 0 ? [...parts, readingOrder(context)].join("\n") : "";
}

/** (b) A human task's body: the package, then the steps and what closes it. */
export function handoffHumanTaskBody(handoff: NewHandoff, task: HumanTaskData, criteria: string): string {
  return [packageMarkdown(handoff), renderHumanTaskBody(task), criteria].filter(Boolean).join("\n\n");
}

/** (b) A question's body: the package, then the question itself, so the person sees what it rests on. */
export function handoffQuestionBody(handoff: NewHandoff, question: string): string {
  return [packageMarkdown(handoff), `**Question:** ${question}`].join("\n\n");
}

/** (c) The Continue chat note's section on an item: where it came from and how what it waits for closed; null when no
 *  hand-off touches it. */
export function handoffChatSection(context: HandoffContext): string | null {
  const parts = [...context.incoming.map(packageMarkdown), ...context.dependencies.map(outcomeMarkdown)];

  return parts.length > 0 ? parts.join("\n\n") : null;
}

function incomingElement(handoff: HandoffView): string {
  const attributes = `from="${handoff.from.taskId}" agent="${handoff.from.agent}"${runAttribute(handoff.from.runId)} intent="${handoff.intent}" gate="${handoff.gate}"`;

  return [`<handoff ${attributes}>`, handoff.package.body, ...refsLines(handoff.package.refs), "</handoff>"].join("\n");
}

function outcomeElement(handoff: HandoffView): string {
  const attributes = `item="${handoff.toItemId}" intent="${handoff.intent}" gate="${handoff.gate}" status="${handoff.targetStatus}"`;

  return [`<handoff-outcome ${attributes}>`, handoff.targetResolution ?? "(no answer)", "</handoff-outcome>"].join("\n");
}

function previousElement(previous: PreviousResult | null): string[] {
  if (!previous) {
    return [];
  }

  const run = previous.runId === null ? "an earlier run" : `RUN-${previous.runId}`;

  return [`<previous-result run="${run}" status="${previous.status}">`, previous.body, "</previous-result>"];
}

function readingOrder(context: HandoffContext): string {
  const lines = [
    ...(context.incoming.length > 0 ? ["Read the hand-off first: it is what the sender gives you and what it asks of you."] : []),
    ...(context.dependencies.length > 0 ? ["Each outcome is how the item your task waited for was closed; act on it before anything else."] : []),
    ...(context.previous ? ["Continue from the previous result: don't redo what it settled; write the whole result again as this run's."] : []),
  ];

  return lines.join("\n");
}

function packageMarkdown(handoff: NewHandoff): string {
  const header = `**Handed off by** ${handoff.from.taskId} (${handoff.from.agent}${handoff.from.runId === null ? "" : `, RUN-${handoff.from.runId}`}): ${INTENT_LINES[handoff.intent]}.`;

  return [header, handoff.package.body, ...refsLines(handoff.package.refs)].join("\n\n");
}

function outcomeMarkdown(handoff: HandoffView): string {
  const closed = handoff.status === "closed" ? `closed ${handoff.targetStatus}` : `still ${handoff.targetStatus}`;

  return [`**${handoff.toItemId}** (${handoff.intent}, gate ${handoff.gate}): ${closed}.`, ...(handoff.targetResolution ? [handoff.targetResolution] : [])].join("\n\n");
}

function runAttribute(runId: number | null): string {
  return runId === null ? "" : ` run="RUN-${runId}"`;
}

function refsLines(refs: HandoffRefs): string[] {
  const groups = [refGroup("Results", refs.results), refGroup("Items", refs.items), refGroup("Notes", refs.notes)].filter((group): group is string => group !== null);

  return groups.length > 0 ? [`Read: ${groups.join("; ")}`] : [];
}

function refGroup(label: string, refs: string[]): string | null {
  return refs.length > 0 ? `${label} ${refs.join(", ")}` : null;
}

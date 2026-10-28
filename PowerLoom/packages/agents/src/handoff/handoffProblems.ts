import { PERSON } from "../taskCreation/taskTargets";
import type { HandoffRequest } from "./models/HandoffRequest";

const RUN_REF = /^RUN-\d+$/;
const ITEM_ID = /^[A-Z]{1,3}-\d+(-\d+)?$/;
const NEW_TASK = /^new:(\d+)$/;

// What only a hand-off can get wrong; the task fields are checked as create_task checks them. A gate is a person's
// decision, so only a person's item carries one, and approve has fixed answers the backend reads.
export function handoffProblems(request: HandoffRequest, createdInRun: number): string[] {
  return [...gateProblems(request), reviewProblem(request), ...refProblems(request, createdInRun)].filter((problem): problem is string => problem !== null);
}

function gateProblems(request: HandoffRequest): (string | null)[] {
  if (request.gate === "approve") {
    return [approveTargetProblem(request), request.steps.length > 0 ? "gate approve has fixed answers (approve | changes, ok | corrections): leave steps empty" : null];
  }

  return [request.gate === "answer" && request.to !== PERSON ? "gate answer is for a person's question or task" : null];
}

function approveTargetProblem(request: HandoffRequest): string | null {
  const isPersonReview = request.to === PERSON && request.item === "task" && request.intent === "review";

  return isPersonReview ? null : "gate approve needs to: person, item: task, intent: review";
}

function reviewProblem(request: HandoffRequest): string | null {
  return request.intent === "review" && request.to !== PERSON ? "a review goes to a person; hand an agent continue, ask or return" : null;
}

function refProblems(request: HandoffRequest, createdInRun: number): string[] {
  const results = request.package.results.filter((ref) => !RUN_REF.test(ref)).map((ref) => `package result "${ref}" is not RUN-<id>`);
  const items = request.package.items.filter((ref) => !isKnownItem(ref, createdInRun)).map((ref) => `package item "${ref}" is neither an item id nor new:<n> of a task you created earlier in this run`);

  return [...results, ...items];
}

function isKnownItem(ref: string, createdInRun: number): boolean {
  const created = NEW_TASK.exec(ref);

  return created ? Number(created[1]) >= 1 && Number(created[1]) <= createdInRun : ITEM_ID.test(ref);
}

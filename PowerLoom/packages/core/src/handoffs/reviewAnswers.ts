import type { ReviewAnswers } from "../models/ReviewAnswers";
import { APPROVE_ANSWER } from "./approvalSteps";

const NEXT_HEADING = "\n### ";
// The wrapping a person gives a fixed answer: backticks or quotes, a code block, a full stop.
const DECISION_WRAPPING = /^[`"'*.!\s]+|[`"'*.!\s]+$/g;
const FACTS_CONFIRMED = ["ok", "okay"];

// The answers of a review human task as humanTaskResolution writes them (`### <n>. <action>`, a blank line, the answer);
// the backend's HandoffGates.FirstAnswerOf reads step 1 the same way.
export function reviewAnswers(resolution: string | null): ReviewAnswers {
  return { decision: stepAnswer(resolution, 1), facts: stepAnswer(resolution, 2) };
}

// `approve` as the person wrote it (HandoffGates.IsApproval): anything around the word is a request for changes.
export function isApproval(decision: string): boolean {
  const word = decision.replace(DECISION_WRAPPING, "").toLowerCase();

  return word === APPROVE_ANSWER || word === "approved";
}

// Step 2 left empty or answered `ok` confirms the facts; anything else corrects them.
export function confirmsFacts(facts: string): boolean {
  const word = facts.replace(DECISION_WRAPPING, "").toLowerCase();

  return word === "" || FACTS_CONFIRMED.includes(word);
}

function stepAnswer(resolution: string | null, step: number): string {
  const start = resolution?.indexOf(`### ${step}.`) ?? -1;

  if (start < 0) {
    return "";
  }

  const body = resolution!.slice(start);
  const answerStart = body.indexOf("\n\n");

  if (answerStart < 0) {
    return "";
  }

  const answer = body.slice(answerStart + 2);
  const end = answer.indexOf(NEXT_HEADING);

  return (end < 0 ? answer : answer.slice(0, end)).trim();
}

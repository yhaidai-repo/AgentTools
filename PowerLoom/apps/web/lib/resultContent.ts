import { loadResult as loadResultOf, resultOwner as resultOwnerOf, type AgentResult, type ResultKind, type ResultOwner } from "@powerloom/core";
import { getDb } from "./db";

// One version's content, loaded only when it is shown; null when the id isn't a result of that kind.
export function loadResult(kind: ResultKind, id: string): Promise<AgentResult | null> {
  return loadResultOf(getDb(), kind, id);
}

// The PBI and the task a result belongs to.
export function resultOwner(result: AgentResult): Promise<ResultOwner> {
  return resultOwnerOf(getDb(), result);
}

import type { AgentResult } from "./AgentResult";
import type { ResultOwner } from "./ResultOwner";

// What result.get answers: the result with its full content and the PBI and task it belongs to.
export type ResultRead = AgentResult & { owner: ResultOwner };

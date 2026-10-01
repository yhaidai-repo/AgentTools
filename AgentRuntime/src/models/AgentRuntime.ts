import type { AgentEvent } from "./AgentEvent";
import type { AgentRequest } from "./AgentRequest";

// One implementation per provider. Callers depend only on this contract.
export interface AgentRuntime {
  readonly provider: string;
  run(request: AgentRequest): AsyncIterable<AgentEvent>;
}

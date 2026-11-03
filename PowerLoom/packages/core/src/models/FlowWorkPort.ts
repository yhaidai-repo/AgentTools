import type { Flow } from "./Flow";
import type { FlowExecution } from "./FlowExecution";
import type { FlowSaveInput } from "./FlowSaveInput";
import type { FlowTarget } from "./FlowTarget";
import type { Outcome } from "./Outcome";

// The flow changes (PowerLoom Flow phase 1): PowerLoom validates the definition (also against the agents' handles),
// keeps the version and records executions; the engine that creates their tasks is phase 2.
export interface FlowWorkPort {
  // Creates or changes a flow (a change bumps its version); the flow as saved.
  saveFlow(input: FlowSaveInput): Promise<Outcome<Flow>>;
  // Deletes a flow and its finished executions; refused while one runs. The deleted flow's name.
  deleteFlow(id: string): Promise<Outcome<string>>;
  // Starts an execution of the flow for a PBI or a task of its vault; the execution as recorded.
  runFlow(id: string, vault: string, target: FlowTarget): Promise<Outcome<FlowExecution>>;
  // Cancels a running execution; the execution as it is now.
  cancelFlowExecution(id: string): Promise<Outcome<FlowExecution>>;
}

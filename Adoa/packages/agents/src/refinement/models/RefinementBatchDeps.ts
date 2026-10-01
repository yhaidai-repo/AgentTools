import type { AgentDeps } from "../../models/AgentDeps";

export interface RefinementBatchDeps extends AgentDeps {
  /** Asks the worker (the only Vault writer) to render the PBI's notes. */
  enqueueRender: (adoId: number) => Promise<void>;
}

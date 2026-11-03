import type { FlowDefinition } from "./FlowDefinition";

// A flow as the Flow app saves it: `id` null for a new one; a changed flow keeps its vault.
export interface FlowSaveInput {
  id: string | null;
  vault: string;
  name: string;
  definition: FlowDefinition;
}

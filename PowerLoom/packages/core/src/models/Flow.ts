import type { FlowDefinition } from "./FlowDefinition";

// A saved flow as the pages and the API show it (the `flow` row with its definition parsed).
export interface Flow {
  id: string;
  vault: string;
  name: string;
  version: number;
  definition: FlowDefinition;
  createdAt: Date;
  updatedAt: Date;
}

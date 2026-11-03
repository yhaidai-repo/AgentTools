// An agent as the palette shows it: the subset of AgentDefinition the canvas needs (read server-side, sent to the client).
export interface FlowAgent {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  /** Task kinds the agent takes; a node picks one of them. */
  handles: string[];
  /** Task kinds the agent may create at run time: the targets an optional edge may point at. */
  canAssign: string[];
}

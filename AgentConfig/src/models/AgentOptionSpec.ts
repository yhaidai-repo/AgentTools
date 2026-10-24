// Declares one agent option, so clients can label it, explain it and check its value.
// Declared by the agent's code (its defaults), never edited by clients; the value lives in AgentDefinition.options.
export interface AgentOptionSpec {
  key: string;
  label: string;
  /** What changes when the value changes. */
  description: string;
  min: number;
  max: number;
}

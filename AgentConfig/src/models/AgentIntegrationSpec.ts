// An outside system the host can give an agent tools for (e.g. a wiki), switched on per agent like web access.
// Declared by the host's code (its defaults), never edited by clients; the switch lives in capabilities.integrations.
export interface AgentIntegrationSpec {
  key: string;
  label: string;
  /** What the agent can do with it, and what the host needs for it (e.g. credentials). */
  description: string;
}

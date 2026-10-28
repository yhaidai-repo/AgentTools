export interface AgentCapabilities {
  /** Web search and fetch, mapped by the runtime adapter to its provider's own tools. */
  webAccess: boolean;
  /** Per declared integration (integrationSpecs): whether the host gives the agent its tools. */
  integrations: Record<string, boolean>;
  /** The runtime's built-in tools in the run's own worktree (AgentRuntime's grants of the same names). Set by the host's
   *  defaults, not the UI, and given only to a run that has a worktree of its own. */
  readCode?: boolean;
  editCode?: boolean;
  shell?: boolean;
  subAgents?: boolean;
}

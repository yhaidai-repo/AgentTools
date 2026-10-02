export interface AgentCapabilities {
  /** Web search and fetch, mapped by the runtime adapter to its provider's own tools. */
  webAccess: boolean;
  /** Per declared integration (integrationSpecs): whether the host gives the agent its tools. */
  integrations: Record<string, boolean>;
}

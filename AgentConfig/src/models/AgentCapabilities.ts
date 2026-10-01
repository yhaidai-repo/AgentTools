export interface AgentCapabilities {
  /** Web search and fetch, mapped by the runtime adapter to its provider's own tools. */
  webAccess: boolean;
}

// What a run may do beyond the request's own tools; nothing by default. Each adapter maps a grant to its provider's
// built-in tools, or ignores the grants it has no tools for.
export interface AgentCapabilities {
  /** Web search and fetch. */
  webAccess?: boolean;
  /** Reading and searching the files of the run's folder. */
  readCode?: boolean;
  /** Editing and creating files inside the run's folder, without asking. */
  editCode?: boolean;
  /** A shell in the run's folder, without asking; it can never push or open pull requests. */
  shell?: boolean;
  /** Sub-agents the run starts itself. */
  subAgents?: boolean;
}

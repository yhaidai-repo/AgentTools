// Where an MCP client reaches the open case's Playwright MCP: DevHub's proxy, with the vault's token.
export interface McpEndpoint {
  url: string;
  headers: Record<string, string>;
}

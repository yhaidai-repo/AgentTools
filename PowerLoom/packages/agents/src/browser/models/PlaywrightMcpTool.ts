// One tool of the pinned Playwright MCP, as playwrightMcpTools.ts lists it (the MCP isn't running when the run
// starts, so the list is kept in the repo; refresh it when the pin in DevHub/playwright-mcp changes). The schema is
// JSON Schema as the MCP sends it; jsonSchemaShape reads the parts it knows.
export interface PlaywrightMcpTool {
  name: string;
  description: string;
  inputSchema: { properties: Record<string, Record<string, unknown>>; required: string[] };
  readOnly: boolean;
}

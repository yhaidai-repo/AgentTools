// One tool of the Azure MCP server as it lists itself: the input schema is JSON Schema (an object with properties).
export interface AzureMcpTool {
  name: string;
  description: string;
  inputSchema: AzureMcpInputSchema;
  readOnly: boolean;
}

export interface AzureMcpInputSchema {
  properties: Record<string, AzureMcpProperty>;
  required: string[];
}

export interface AzureMcpProperty {
  /** One type, or a list such as ["integer", "null"]. */
  type?: string | string[];
  description?: string;
  enum?: string[];
  items?: { type?: string };
}

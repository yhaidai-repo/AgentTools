// How a tool behaves, for a client that gates calls (an MCP client's permission mode): it only reads, or its change is
// hard to undo (a delete, a finish). Both left out = a plain write.
export interface ToolAnnotations {
  readOnly?: boolean;
  destructive?: boolean;
}

// MCP tool names allow no dot: a command `pbi.read` is the tool `pbi_read`.
export function commandToolName(commandName: string): string {
  return commandName.replace(/\./g, "_");
}

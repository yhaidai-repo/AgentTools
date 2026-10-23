// How a command touches PowerLoom, for callers that gate calls (an MCP client's permission mode shows read-only and
// destructive hints): `read` changes nothing, `destructive` is hard to undo (a delete, a finish, a close). A command
// without an effect is a plain write.
export type CommandEffect = "read" | "destructive";

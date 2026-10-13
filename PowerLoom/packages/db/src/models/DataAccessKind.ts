// Outside systems (sql, azureLogs, cosmos, serviceBus, mongo, confluence, localStack) keep the long retention; the rest is every
// other tool call of a run: the cached repos, the vault docs, the web, skills, PowerLoom's own tools, anything new.
export type DataAccessKind = "sql" | "azureLogs" | "cosmos" | "serviceBus" | "mongo" | "confluence" | "localStack" | "repo" | "docs" | "web" | "skills" | "internal" | "other";

export const OUTSIDE_KINDS: DataAccessKind[] = ["sql", "azureLogs", "cosmos", "serviceBus", "mongo", "confluence", "localStack"];

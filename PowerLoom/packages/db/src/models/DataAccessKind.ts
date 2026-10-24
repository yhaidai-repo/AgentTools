// Outside systems (sql, azure, cosmos, mongo, serviceBus, confluence, localStack, ado) keep the long retention; the rest
// is every other tool call of a run: the cached repos, the vault docs, the web, skills, PowerLoom's own tools, anything new.
export type DataAccessKind = "sql" | "azure" | "cosmos" | "mongo" | "serviceBus" | "confluence" | "localStack" | "ado" | "repo" | "docs" | "web" | "skills" | "internal" | "other";

export const OUTSIDE_KINDS: DataAccessKind[] = ["sql", "azure", "cosmos", "mongo", "serviceBus", "confluence", "localStack", "ado"];

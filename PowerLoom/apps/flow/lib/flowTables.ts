// PowerLoom's Flows feature creates the `flow` and `flow_execution` tables (EF migration 20261103205608_Flows) when the
// backend starts. A Flow app in front of a backend that hasn't migrated yet gets Postgres's undefined_table (42P01)
// from every flow read: the pages say so instead of failing.
const UNDEFINED_TABLE = "42P01";

export function isMissingFlowTables(error: unknown): boolean {
  return codeOf(error) === UNDEFINED_TABLE || codeOf((error as { cause?: unknown } | null)?.cause) === UNDEFINED_TABLE;
}

function codeOf(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;

  return typeof code === "string" ? code : null;
}

/** The read's value, or null when the flow tables are missing; any other failure is thrown. */
export async function unlessFlowTablesMissing<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (isMissingFlowTables(error)) return null;
    throw error;
  }
}

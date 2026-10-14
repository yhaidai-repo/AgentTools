// A read's documents, or why it didn't run: an answer for the agent, never thrown. `refused` = a guard said no;
// `denied` = the server refused the connection string's user (the data access log and the access requests tell them apart).
export type MongoAnswer = { ok: true; documents: Record<string, unknown>[]; truncated: boolean } | { ok: false; message: string; refused?: boolean; denied?: boolean };

import type { AzureRows } from "./AzureRows";

// A read's rows, or why it didn't run: an answer for the agent, never thrown. `refused` = a guard said no; `denied` =
// the service refused the sign-in or key (the data access log and the access requests tell them apart).
export type AzureAnswer = { ok: true; rows: AzureRows; note: string | null } | { ok: false; message: string; refused?: boolean; denied?: boolean };

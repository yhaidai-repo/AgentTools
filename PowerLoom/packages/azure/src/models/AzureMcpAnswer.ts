// A tool call's outcome for the agent, never thrown: the server's results as text, or why it didn't run. `denied` =
// the sign-in was missing or refused (401/403), which raises an access request.
export type AzureMcpAnswer = { ok: true; text: string; rows: number | null } | { ok: false; message: string; denied: boolean };

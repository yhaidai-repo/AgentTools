// Why a sandbox call didn't do it: `denied` = the service refused the token, `refused` = a limit or rule said no (a
// path outside the workspace, too many sessions, the disk cap), `failed` = anything else.
export type SandboxFailure = "denied" | "refused" | "failed";

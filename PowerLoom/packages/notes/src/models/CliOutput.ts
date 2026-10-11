// The CLI's last stdout line (JSON), or why there was none.
export type CliOutput = { ok: true; json: unknown } | { ok: false; error: string };

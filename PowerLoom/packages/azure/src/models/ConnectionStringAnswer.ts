// A connection string fetched with the sign-in, or why not: `denied` = nobody signed in or Azure refused the account.
export type ConnectionStringAnswer = { ok: true; connectionString: string } | { ok: false; message: string; denied: boolean };

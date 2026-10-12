import type { SqlRows } from "./SqlRows";

// A query's rows, or why it didn't run (refused, can't sign in, a SQL error): an answer for the agent, never thrown.
export type SqlAnswer = { ok: true; rows: SqlRows } | { ok: false; message: string };

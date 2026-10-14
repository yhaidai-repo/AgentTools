import type { AzureMcpAnswer } from "./models/AzureMcpAnswer";

// An answer's text is cut here so one wide result can't fill the agent's context (as for Read SQL).
const MAX_ANSWER_CHARS = 60_000;

// Entra and the services answer these when the token is missing, expired or not allowed on the resource; some
// services wrap them in a 500 with the real status in the message, and the `az` shim answers with az's own
// "az login" sentence when nobody signed in.
const DENIED_STATUSES = [401, 403];
const DENIED_TEXT = /\b(401|403)\b|unauthori[sz]ed|forbidden|az login|not signed in/i;

interface ServerAnswer {
  status?: number;
  message?: string;
  results?: unknown;
}

// The server's JSON answer `{status, message, results}` as an answer for the agent: the results as text, cut, with
// the row count of the first list in them; a non-200 status is its message, `denied` when it is about access.
export function answerOf(text: string, isError: boolean): AzureMcpAnswer {
  const answer = parse(text);

  if (!answer) {
    return isError ? { ok: false, message: text, denied: DENIED_TEXT.test(text) } : { ok: true, text: cut(text), rows: null };
  }

  if (answer.status !== 200 || isError) {
    const message = answer.message || text;

    return { ok: false, message: cut(message), denied: DENIED_STATUSES.includes(answer.status ?? 0) || DENIED_TEXT.test(message) };
  }

  return { ok: true, text: cut(JSON.stringify(answer.results ?? null, null, 1)), rows: rowsOf(answer.results) };
}

function parse(text: string): ServerAnswer | null {
  try {
    const value: unknown = JSON.parse(text);

    return value && typeof value === "object" && !Array.isArray(value) ? (value as ServerAnswer) : null;
  } catch {
    return null;
  }
}

// How many items the agent got: the results list itself, or the first list among its fields.
function rowsOf(results: unknown): number | null {
  if (Array.isArray(results)) {
    return results.length;
  }

  if (!results || typeof results !== "object") {
    return null;
  }

  const list = Object.values(results).find((value) => Array.isArray(value)) as unknown[] | undefined;

  return list ? list.length : null;
}

function cut(text: string): string {
  if (text.length <= MAX_ANSWER_CHARS) {
    return text;
  }

  return `${text.slice(0, MAX_ANSWER_CHARS)}\n\n[cut at ${MAX_ANSWER_CHARS} of ${text.length} characters: narrow the query or ask for fewer fields]`;
}

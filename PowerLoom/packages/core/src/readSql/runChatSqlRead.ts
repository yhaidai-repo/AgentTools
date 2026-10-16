import type { DataAccessOutcome } from "@powerloom/db";
import { SqlReader, sqlRowsText, type SqlAnswer, type SqlRowsText } from "@powerloom/sql";
import { recordDataAccess } from "../dataAccessLog";
import type { ChatSqlRead } from "../models/ChatSqlRead";
import type { CommandContext } from "../models/CommandContext";
import type { DataAccessRow } from "../models/DataAccessRow";
import type { Outcome } from "../models/Outcome";
import type { SqlConnectionSettings } from "../models/SqlConnectionSettings";
import { enabledSqlConnection } from "./enabledSqlConnection";
import { sqlTarget } from "./sqlTarget";

const reader = new SqlReader();

// A chat's SQL read (user decision 2026-10-16): the agents' reader with its read-only guards and caps, gated by the
// vault's Read SQL, and logged like an agent's call but without a run.
export async function runChatSqlRead(context: CommandContext, read: ChatSqlRead): Promise<Outcome<SqlRowsText>> {
  const connection = await enabledSqlConnection(context.db, read.vault, read.connection);

  if (!connection.ok) {
    return connection;
  }

  const startedAt = new Date();
  const answer = await read.read(reader, connection.value.connectionString);
  const outcome = outcomeOf(answer);

  await recordDataAccess(context.db, { ...requestRow(context, read, connection.value, startedAt), ...resultRow(answer, outcome) });

  return outcome;
}

function outcomeOf(answer: SqlAnswer): Outcome<SqlRowsText> {
  return answer.ok ? { ok: true, value: sqlRowsText(answer.rows) } : { ok: false, error: answer.message };
}

function requestRow(context: CommandContext, read: ChatSqlRead, connection: SqlConnectionSettings, startedAt: Date): Omit<DataAccessRow, "outcome"> {
  return {
    vault: read.vault,
    agentId: context.actor,
    runId: null,
    tool: read.tool,
    kind: "sql",
    resource: connection.name,
    target: sqlTarget(connection),
    request: read.request,
    startedAt,
    durationMs: Date.now() - startedAt.getTime(),
  };
}

function resultRow(answer: SqlAnswer, outcome: Outcome<SqlRowsText>): Pick<DataAccessRow, "outcome" | "reason" | "rows" | "bytes" | "truncated"> {
  if (!outcome.ok) {
    return { outcome: logOutcome(answer), reason: outcome.error, rows: null, bytes: Buffer.byteLength(outcome.error, "utf8"), truncated: false };
  }

  return { outcome: "ok", reason: null, rows: outcome.value.rows, bytes: Buffer.byteLength(outcome.value.text, "utf8"), truncated: outcome.value.truncated };
}

// refused = the read-only check said no; denied = the server refused the login; failed = anything else.
function logOutcome(answer: SqlAnswer): DataAccessOutcome {
  if (answer.ok) {
    return "ok";
  }

  if (answer.refused) {
    return "refused";
  }

  return answer.denied ? "denied" : "failed";
}

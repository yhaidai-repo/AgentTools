import { LogsQueryClient, LogsQueryResultStatus, type LogsTable } from "@azure/monitor-query-logs";
import { kqlProblem, timespanDuration } from "./kqlGuard";
import type { AzureAnswer } from "./models/AzureAnswer";
import type { AzureTokenCredential } from "./models/AzureTokenCredential";
import { NotSignedInError } from "./models/NotSignedInError";

// What one query may cost (as Read SQL): rows returned and server time.
const MAX_ROWS = 200;
const SERVER_TIMEOUT_SECONDS = 30;

// Entra and the logs API answer these when the token is missing, expired or not allowed on the resource.
const DENIED_STATUSES = [401, 403];

type Credential = ConstructorParameters<typeof LogsQueryClient>[0];

// Reads App Insights / Log Analytics for agents with the user's own sign-in (user decision 2026-10-13): KQL queries
// only, capped; a missing sign-in or a refused token is `denied`.
export class LogsReader {
  private readonly client: LogsQueryClient;

  constructor(credential: AzureTokenCredential) {
    this.client = new LogsQueryClient(credential as unknown as Credential);
  }

  async query(resourceId: string, kql: string, timespan: string | undefined): Promise<AzureAnswer> {
    const problem = kqlProblem(kql);

    if (problem) {
      return { ok: false, message: problem, refused: true };
    }

    const span = timespanDuration(timespan);

    if ("problem" in span) {
      return { ok: false, message: span.problem, refused: true };
    }

    try {
      return answerOf(await this.client.queryResource(resourceId, kql, span, { serverTimeoutInSeconds: SERVER_TIMEOUT_SECONDS }));
    } catch (error) {
      return failure(error);
    }
  }
}

function answerOf(result: Awaited<ReturnType<LogsQueryClient["queryResource"]>>): AzureAnswer {
  const tables = result.status === LogsQueryResultStatus.Success ? result.tables : result.partialTables;
  const note = result.status === LogsQueryResultStatus.Success ? null : `[partial result: ${result.partialError.message}]`;
  const table = tables[0];

  if (!table) {
    return { ok: true, rows: { columns: [], rows: [], truncated: false }, note };
  }

  return { ok: true, rows: rowsOf(table), note: [note, tables.length > 1 ? `[${tables.length - 1} more table(s) not shown]` : null].filter(Boolean).join(" ") || null };
}

function rowsOf(table: LogsTable) {
  return { columns: table.columnDescriptors.map((column) => column.name), rows: table.rows.slice(0, MAX_ROWS) as unknown[][], truncated: table.rows.length > MAX_ROWS };
}

function failure(error: unknown): AzureAnswer {
  if (error instanceof NotSignedInError) {
    return { ok: false, message: error.message, denied: true };
  }

  const status = (error as { statusCode?: number }).statusCode;

  return { ok: false, message: (error as Error).message, denied: status !== undefined && DENIED_STATUSES.includes(status) };
}

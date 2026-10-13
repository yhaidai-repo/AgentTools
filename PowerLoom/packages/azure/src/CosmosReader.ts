import { CosmosClient } from "@azure/cosmos";
import type { AzureAnswer } from "./models/AzureAnswer";
import type { AzureRows } from "./models/AzureRows";

// What one query may cost (as Read SQL): items returned per call.
const MAX_ITEMS = 200;

// Cosmos answers these for a wrong or rotated key, or a role without read.
const DENIED_CODES = [401, 403];

// Reads Cosmos DB (NoSQL) for agents with the account's read-only key (user decision 2026-10-13): the service itself
// refuses writes with such a key; the reader only ever queries. One client per call.
export class CosmosReader {
  // Every database and container of the account, with the container's partition key.
  async listContainers(endpoint: string, key: string): Promise<AzureAnswer> {
    return this.withClient(endpoint, key, async (client) => {
      const { resources: databases } = await client.databases.readAll().fetchAll();
      const rows: unknown[][] = [];

      for (const database of databases) {
        const { resources: containers } = await client.database(database.id).containers.readAll().fetchAll();

        rows.push(...containers.map((container) => [database.id, container.id, container.partitionKey?.paths?.join(", ") ?? ""]));
      }

      return { ok: true, rows: { columns: ["database", "container", "partitionKey"], rows, truncated: false }, note: null };
    });
  }

  async query(endpoint: string, key: string, database: string, container: string, sql: string): Promise<AzureAnswer> {
    if (!/^\s*SELECT\b/i.test(sql)) {
      return { ok: false, message: "A Cosmos query starts with SELECT, e.g. SELECT TOP 20 c.id, c.status FROM c WHERE c.patientId = '42'.", refused: true };
    }

    return this.withClient(endpoint, key, async (client) => {
      const iterator = client.database(database).container(container).items.query(sql, { maxItemCount: MAX_ITEMS });
      const page = await iterator.fetchNext();
      const items = (page.resources ?? []) as Record<string, unknown>[];

      return { ok: true, rows: itemRows(items), note: iterator.hasMoreResults() ? `[first ${items.length} item(s) only: narrow the query]` : null };
    });
  }

  private async withClient(endpoint: string, key: string, read: (client: CosmosClient) => Promise<AzureAnswer>): Promise<AzureAnswer> {
    const client = new CosmosClient({ endpoint, key });

    try {
      return await read(client);
    } catch (error) {
      return failure(error);
    } finally {
      client.dispose();
    }
  }
}

// Items as one row each, the columns being every top-level field seen; nested values as JSON.
function itemRows(items: Record<string, unknown>[]): AzureRows {
  const columns = [...new Set(items.flatMap((item) => Object.keys(item)))].filter((name) => !name.startsWith("_"));
  const rows = items.map((item) => columns.map((column) => item[column]));

  return { columns, rows, truncated: false };
}

function failure(error: unknown): AzureAnswer {
  const code = Number((error as { code?: number | string }).code);

  return { ok: false, message: (error as Error).message, denied: DENIED_CODES.includes(code) };
}

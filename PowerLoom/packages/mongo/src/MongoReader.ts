import { MongoClient, MongoServerError, type Document } from "mongodb";
import type { MongoAnswer } from "./models/MongoAnswer";
import { filterProblem, pipelineProblem } from "./mongoGuard";

// What one read may cost (as Read SQL): documents returned and server time.
const MAX_DOCUMENTS = 200;
const DEFAULT_DOCUMENTS = 20;
const QUERY_TIMEOUT_MS = 30_000;
const CONNECT_TIMEOUT_MS = 15_000;

// describe samples one document per collection for its fields; a database with more collections lists the rest by name only.
const MAX_SAMPLED_COLLECTIONS = 50;

// The server answers these for a wrong or rotated key, or a user without read: Unauthorized, AuthenticationFailed.
const DENIED_CODES = [13, 18];

type Filter = Record<string, unknown>;

// Reads Cosmos DB for MongoDB (and any Mongo) for agents with the account's read-only connection string (user
// decision 2026-10-14: fetched with the vault's sign-in at call time, never stored). Only find, aggregate and
// listings; the guards refuse what writes or runs code. One client per call.
export class MongoReader {
  // The account's databases, or one database's collections with the top-level fields of a sample document each.
  async describe(connectionString: string, database: string | null): Promise<MongoAnswer> {
    return this.withClient(connectionString, (client) => (database ? collectionsOf(client, database) : databasesOf(client)));
  }

  async find(connectionString: string, database: string, collection: string, filter: Filter, projection: Filter | undefined, sort: Filter | undefined, limit: number | undefined): Promise<MongoAnswer> {
    const problem = filterProblem(filter) ?? filterProblem(projection) ?? filterProblem(sort);

    if (problem) {
      return { ok: false, message: problem, refused: true };
    }

    const take = Math.min(Math.max(limit ?? DEFAULT_DOCUMENTS, 1), MAX_DOCUMENTS);

    return this.withClient(connectionString, async (client) => {
      const cursor = client.db(database).collection(collection).find(filter, { projection, sort: sort as Document, limit: take + 1, maxTimeMS: QUERY_TIMEOUT_MS });

      return documentsAnswer(await cursor.toArray(), take);
    });
  }

  async aggregate(connectionString: string, database: string, collection: string, pipeline: Document[]): Promise<MongoAnswer> {
    const problem = pipelineProblem(pipeline);

    if (problem) {
      return { ok: false, message: problem, refused: true };
    }

    return this.withClient(connectionString, async (client) => {
      const cursor = client.db(database).collection(collection).aggregate([...pipeline, { $limit: MAX_DOCUMENTS + 1 }], { maxTimeMS: QUERY_TIMEOUT_MS });

      return documentsAnswer(await cursor.toArray(), MAX_DOCUMENTS);
    });
  }

  private async withClient(connectionString: string, read: (client: MongoClient) => Promise<MongoAnswer>): Promise<MongoAnswer> {
    const client = new MongoClient(connectionString, { serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS, connectTimeoutMS: CONNECT_TIMEOUT_MS, maxPoolSize: 1 });

    try {
      await client.connect();

      return await read(client);
    } catch (error) {
      return failure(error);
    } finally {
      await client.close().catch(() => undefined);
    }
  }
}

// One more document than asked is fetched, so "truncated" is known without a count.
function documentsAnswer(documents: Document[], take: number): MongoAnswer {
  return { ok: true, documents: documents.slice(0, take) as Record<string, unknown>[], truncated: documents.length > take };
}

async function databasesOf(client: MongoClient): Promise<MongoAnswer> {
  const list = await client.db("admin").admin().listDatabases();
  const documents = list.databases.map((database) => ({ database: database.name, sizeOnDisk: database.sizeOnDisk ?? null }));

  return { ok: true, documents, truncated: false };
}

async function collectionsOf(client: MongoClient, database: string): Promise<MongoAnswer> {
  const names = (await client.db(database).listCollections({}, { nameOnly: true }).toArray()).map((collection) => collection.name).sort();
  const sampled = names.slice(0, MAX_SAMPLED_COLLECTIONS);
  const samples = await Promise.all(sampled.map((name) => client.db(database).collection(name).findOne({}, { maxTimeMS: QUERY_TIMEOUT_MS })));
  const documents = names.map((name, index) => ({ collection: name, fields: index < sampled.length ? Object.keys(samples[index] ?? {}) : "not sampled" }));

  return { ok: true, documents, truncated: false };
}

function failure(error: unknown): MongoAnswer {
  const code = error instanceof MongoServerError ? Number(error.code) : NaN;

  return { ok: false, message: (error as Error).message, denied: DENIED_CODES.includes(code) };
}

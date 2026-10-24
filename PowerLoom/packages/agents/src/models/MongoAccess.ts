import type { CosmosConnectionStrings } from "@powerloom/azure";
import type { MongoReader } from "@powerloom/mongo";

// The run's Mongo reads: the reader, and the connection strings fetched with the vault's sign-in per account.
export interface MongoAccess {
  reader: MongoReader;
  connectionStrings: CosmosConnectionStrings;
}

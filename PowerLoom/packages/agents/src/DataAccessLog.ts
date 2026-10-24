import { recordDataAccess } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import type { DataAccessEntry } from "./models/DataAccessEntry";

// The data access log for a run's tools; the write and its rules live in core, shared with the chats' SQL commands.
export class DataAccessLog {
  constructor(private readonly db: PowerLoomDb) {}

  record(entry: DataAccessEntry): Promise<void> {
    return recordDataAccess(this.db, entry);
  }
}

import { wwwRecord } from "@adoa/db";
import type { CommandContext } from "../models/CommandContext";
import type { NewWwwRecord } from "../models/NewWwwRecord";
import type { WwwJob } from "../models/WwwJob";
import { WWW_QUEUE } from "../queues";

// Stores the record and queues it for the worker, the only writer of vaults; the log's WWW-nnn id is set when written.
export async function createWwwRecord(context: CommandContext, record: NewWwwRecord): Promise<number> {
  const [row] = await context.db.insert(wwwRecord).values(record).returning({ id: wwwRecord.id });
  const job: WwwJob = { recordId: row.id };

  await context.jobs.send(WWW_QUEUE, job);

  return row.id;
}

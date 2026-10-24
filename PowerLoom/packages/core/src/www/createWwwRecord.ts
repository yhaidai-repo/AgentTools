import { wwwRecord } from "@powerloom/db";
import type { CommandContext } from "../models/CommandContext";
import type { NewWwwRecord } from "../models/NewWwwRecord";

// Stores the record and hands it to PowerLoom, which appends it to the vault's log; the log's WWW-nnn id is set when
// written.
export async function createWwwRecord(context: CommandContext, record: NewWwwRecord): Promise<number> {
  const [row] = await context.db.insert(wwwRecord).values(record).returning({ id: wwwRecord.id });

  await context.powerloom.addRecord("www", String(row.id));

  return row.id;
}

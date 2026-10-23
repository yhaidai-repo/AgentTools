import { periodStart as periodStartOf } from "@powerloom/core";
import { getDb } from "./db";

// When the period starts for the vault (core's periodStart with the web's database).
export function periodStart(range: string, vault: string): Promise<Date> {
  return periodStartOf(getDb(), range, vault);
}

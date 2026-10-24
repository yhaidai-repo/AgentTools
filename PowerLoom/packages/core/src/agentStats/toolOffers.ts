import { config, dataAccess, type PowerLoomDb } from "@powerloom/db";
import { desc, eq, like } from "drizzle-orm";
import type { OfferedTool } from "../models/OfferedTool";
import type { ToolOffer } from "../models/ToolOffer";
import { saveValue } from "../settings";

// What each agent's latest run, and the latest chat session, was given, one config row per vault and holder: the
// Tools tab lists every tool there is, used or not (user request 2026-10-25), from what the runs really got.
const OFFER_KEY = "toolsOffered";

export async function saveToolOffer(db: PowerLoomDb, vault: string, holder: string, tools: OfferedTool[]): Promise<void> {
  const offer: ToolOffer = { holder, offeredAt: new Date().toISOString(), tools };

  await saveValue(db, offerKey(vault, holder), offer);
}

export async function readToolOffers(db: PowerLoomDb, vault: string): Promise<ToolOffer[]> {
  const prefix = offerKey(vault, "");
  const rows = await db.select({ key: config.key, value: config.value }).from(config).where(like(config.key, `${prefix}%`));

  return rows.filter((row) => row.key.startsWith(prefix)).map((row) => row.value as ToolOffer);
}

// The latest call per tool over the vault's whole log (any agent), for "last used".
export async function latestToolCalls(db: PowerLoomDb, vault: string): Promise<Map<string, Date>> {
  const rows = await db.selectDistinctOn([dataAccess.tool], { tool: dataAccess.tool, startedAt: dataAccess.startedAt }).from(dataAccess).where(eq(dataAccess.vault, vault)).orderBy(dataAccess.tool, desc(dataAccess.startedAt));

  return new Map(rows.map((row) => [row.tool, row.startedAt]));
}

function offerKey(vault: string, holder: string): string {
  return `${OFFER_KEY}:${vault}:${holder}`;
}

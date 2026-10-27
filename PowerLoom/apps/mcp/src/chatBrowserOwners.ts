import type { PowerLoomDb } from "@powerloom/db";
import { sql } from "drizzle-orm";

// A lease ties retained recordings to their vault even after the in-memory session or MCP process ends.
export async function openBrowserOwner(db: PowerLoomDb, owner: string, vault: string): Promise<void> {
  await db.execute(sql`insert into chat_browser_owner(owner, vault, expires_at) values (${owner}, ${vault}, now() + interval '5 minutes')`);
}

export async function renewBrowserOwners(db: PowerLoomDb, owners: string[]): Promise<void> {
  if (!owners.length) return;
  await db.execute(sql`update chat_browser_owner set expires_at=now() + interval '5 minutes' where closed_at is null and owner in (${sql.join(owners.map(owner => sql`${owner}`), sql`, `)})`);
}

export async function closeBrowserOwner(db: PowerLoomDb, owner: string): Promise<void> {
  await db.execute(sql`update chat_browser_owner set closed_at=now() where owner=${owner} and closed_at is null`);
}

import type { PowerLoomDb } from "@powerloom/db";
import type { Outcome } from "../models/Outcome";
import type { ReadSqlSettings } from "../models/ReadSqlSettings";
import type { SqlConnectionSettings } from "../models/SqlConnectionSettings";
import { readReadSqlSettings } from "../settings";

// The gate for a chat's read (user decision 2026-10-16): the vault's Read SQL switch and the connection's own, as
// Settings shows them. A chat is the user, so there is no per-agent grant.
export async function enabledSqlConnection(db: PowerLoomDb, vault: string, name: string): Promise<Outcome<SqlConnectionSettings>> {
  const settings = await readReadSqlSettings(db, vault);

  if (!settings.enabled) {
    return { ok: false, error: `Read SQL is off for vault ${vault}: switch it on in PowerLoom's Settings.` };
  }

  const connection = settings.connections.find((entry) => entry.name === name && entry.enabled);

  return connection ? { ok: true, value: connection } : { ok: false, error: `Vault ${vault} has no enabled connection ${name}. Enabled: ${enabledNames(settings)}.` };
}

function enabledNames(settings: ReadSqlSettings): string {
  const names = settings.connections.filter((connection) => connection.enabled).map((connection) => connection.name);

  return names.length > 0 ? names.join(", ") : "none";
}

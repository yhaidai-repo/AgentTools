import type { PoolClient } from "pg";
import { AGENT_ID, LEGACY_AGENT_ID } from "./legacyNames";
import { renameStoredAgent, renameToolOffer } from "./renameStoredValues";
import { tableExists } from "./tableExists";

type Json = Record<string, unknown>;

// Every stored agent, the Demonstration agent's id included, under the names the code uses now. The user's settings
// (switch, schedule, model, limits, budgets, options, integrations) travel with the definition. Agents made in the UI
// may list the old task type in handles or canAssign; those follow too.
export async function renameAgentRows(client: PoolClient): Promise<number> {
  const rows = (await client.query("SELECT id, definition FROM agent_config.agent FOR UPDATE")).rows as { id: string; definition: Json }[];
  let changed = 0;

  for (const row of rows) {
    changed += (await renameAgentRow(client, row)) ? 1 : 0;
  }

  return changed;
}

// What each agent's last run was offered, kept per vault under `toolsOffered:<vault>:<agent>`.
export async function renameToolOfferRows(client: PoolClient): Promise<number> {
  if (!(await tableExists(client, "public.config"))) {
    return 0;
  }

  const rows = (await client.query("SELECT key, value FROM public.config WHERE key LIKE 'toolsOffered:%'")).rows as { key: string; value: Json }[];
  let changed = 0;

  for (const row of rows) {
    changed += (await renameToolOfferRow(client, row)) ? 1 : 0;
  }

  return changed;
}

async function renameAgentRow(client: PoolClient, row: { id: string; definition: Json }): Promise<boolean> {
  const id = row.id === LEGACY_AGENT_ID ? AGENT_ID : row.id;
  const definition = renameStoredAgent(row.definition);

  if (id === row.id && JSON.stringify(definition) === JSON.stringify(row.definition)) {
    return false;
  }

  if (id !== row.id && (await agentExists(client, id))) {
    throw new Error(`Cannot rename agent ${row.id} to ${id}: both ids exist. Resolve the conflicting agent before restarting; no rename changes were saved.`);
  }

  await client.query("UPDATE agent_config.agent SET id = $2, definition = $3::jsonb, updated_at = now() WHERE id = $1", [row.id, id, JSON.stringify(definition)]);

  return true;
}

async function renameToolOfferRow(client: PoolClient, row: { key: string; value: Json }): Promise<boolean> {
  const key = renameOfferKey(row.key);
  const value = renameToolOffer(row.value);

  if (key === row.key && JSON.stringify(value) === JSON.stringify(row.value)) {
    return false;
  }

  if (key !== row.key && (await offerExists(client, key))) {
    throw new Error(`Cannot rename tool offer ${row.key} to ${key}: both keys exist. No rename changes were saved.`);
  }

  await client.query("UPDATE public.config SET key = $2, value = $3::jsonb WHERE key = $1", [row.key, key, JSON.stringify(value)]);

  return true;
}

function renameOfferKey(key: string): string {
  const parts = key.split(":");
  const holder = parts.pop() ?? "";

  return [...parts, holder === LEGACY_AGENT_ID ? AGENT_ID : holder].join(":");
}

async function agentExists(client: PoolClient, id: string): Promise<boolean> {
  return (await client.query("SELECT 1 FROM agent_config.agent WHERE id = $1", [id])).rowCount === 1;
}

async function offerExists(client: PoolClient, key: string): Promise<boolean> {
  return (await client.query("SELECT 1 FROM public.config WHERE key = $1", [key])).rowCount === 1;
}

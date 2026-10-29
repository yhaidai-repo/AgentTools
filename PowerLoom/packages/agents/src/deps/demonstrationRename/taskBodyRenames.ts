import { createHash } from "node:crypto";
import { readGuideRequest } from "@powerloom/core";
import type { PoolClient } from "pg";
import { tableExists } from "./tableExists";

const FENCE = "\x60\x60\x60";
const LEGACY_FENCE = FENCE + "support-guide";
const RENAMED_FENCE = FENCE + "demonstration";
type Data = Record<string, unknown>;

// The body is part of the checkpoint fingerprint. Keep a valid checkpoint through this mechanical rename, while a
// genuinely edited request still invalidates it. Reports remain subject to the writer's normal runtime revalidation.
export async function renameTaskBodies(client: PoolClient): Promise<number> {
  if (!(await tableExists(client, "public.local_item"))) return 0;
  const rows = (await client.query(
    "SELECT id, body, data FROM public.local_item WHERE kind = 'demonstration' AND position($1 in body) > 0 FOR UPDATE",
    [LEGACY_FENCE],
  )).rows as { id: string; body: string; data: Data | null }[];

  for (const row of rows) {
    const body = row.body.replaceAll(LEGACY_FENCE, RENAMED_FENCE);
    const data = renamedCheckpoint(row.body, body, row.data);
    await client.query("UPDATE public.local_item SET body = $2, data = $3::jsonb WHERE id = $1", [row.id, body, data === null ? null : JSON.stringify(data)]);
  }
  return rows.length;
}

export function renamedCheckpoint(previousBody: string, body: string, data: Data | null): Data | null {
  const saved = data?.guideCheckpoint;
  if (saved === null || typeof saved !== "object" || !("requestHash" in saved)) return data;

  try {
    const request = readGuideRequest(body);
    const fingerprint = (value: string, input: unknown = request) => createHash("sha256").update(JSON.stringify({ request: input, body: value, goal: data?.goal })).digest("hex");
    const { build, ...beforeBuildInput } = request;
    const matchesBeforeBuildInput = build === "" && saved.requestHash === fingerprint(previousBody, beforeBuildInput);
    if (saved.requestHash === fingerprint(previousBody) || matchesBeforeBuildInput) {
      return { ...data, guideCheckpoint: { ...saved, requestHash: fingerprint(body) } };
    }
  } catch {
    // Malformed requests stay malformed; renaming never grants them a valid checkpoint.
  }
  return data;
}

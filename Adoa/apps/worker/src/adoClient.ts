import { AdoClient } from "@adoa/ado";
import { readAdoSettings } from "@adoa/core";
import type { AdoaDb } from "@adoa/db";
import { requireEnv } from "./env";

export async function createAdoClient(db: AdoaDb): Promise<AdoClient> {
  const ado = await readAdoSettings(db);

  if (!ado) {
    throw new Error("ADO settings are not configured");
  }

  return new AdoClient({ orgUrl: ado.orgUrl, project: ado.project, team: ado.team, pat: requireEnv("ADO_PAT") });
}

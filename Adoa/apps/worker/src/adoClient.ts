import { AdoClient } from "@adoa/ado";
import { isAdoConfigured, readAdoSettings } from "@adoa/core";
import type { AdoaDb } from "@adoa/db";

export async function createAdoClient(db: AdoaDb, vault: string): Promise<AdoClient> {
  const ado = await readAdoSettings(db, vault);

  if (!isAdoConfigured(ado)) {
    throw new Error(`the Azure DevOps integration of ${vault} isn't configured`);
  }

  return new AdoClient({ orgUrl: ado.orgUrl, project: ado.project, team: ado.team, pat: ado.pat });
}

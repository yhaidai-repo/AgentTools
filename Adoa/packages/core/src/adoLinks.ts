import type { AdoSettings } from "./models/AdoSettings";

// A PBI's page in Azure DevOps; null for a local PBI (no counterpart) or without the vault's integration.
export function workItemUrl(ado: AdoSettings | null, pbi: { adoId: number; source: "ado" | "local" }): string | null {
  if (!ado || pbi.source === "local") {
    return null;
  }

  return `${ado.orgUrl.replace(/\/+$/, "")}/${encodeURIComponent(ado.project)}/_workitems/edit/${pbi.adoId}`;
}

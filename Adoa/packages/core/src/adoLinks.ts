import type { AdoSettings } from "./models/AdoSettings";

export function workItemUrl(ado: AdoSettings, adoId: number): string {
  return `${ado.orgUrl.replace(/\/+$/, "")}/${encodeURIComponent(ado.project)}/_workitems/edit/${adoId}`;
}

import type { AzureResourceKind } from "@powerloom/core";

// A Read Azure resource as the Settings page shows it: a Mongo string only by its host.
export interface AzureResourceRow {
  name: string;
  kind: AzureResourceKind;
  display: string;
  enabled: boolean;
}

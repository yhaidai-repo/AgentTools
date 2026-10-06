import type { AdoSettings } from "@adoa/core";

// What the integration form shows: everything but the token, which the browser never gets.
export interface AdoIntegrationValues extends Omit<AdoSettings, "pat"> {
  hasPat: boolean;
}

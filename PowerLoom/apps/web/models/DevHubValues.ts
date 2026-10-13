import type { DevHubSettings } from "@powerloom/core";

// What the DevHub form shows: everything but the token, which the browser never gets.
export interface DevHubValues extends Omit<DevHubSettings, "token"> {
  hasToken: boolean;
}

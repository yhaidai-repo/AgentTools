import type { LocalStackSettings } from "@powerloom/core";

// What the Local stack form shows: everything but the token, which the browser never gets.
export interface LocalStackValues extends Omit<LocalStackSettings, "token"> {
  hasToken: boolean;
}

import type { StateLevel } from "./StateLevel";

// PowerLoom's schedule ticker; the dates are ISO strings as the API sends them.
export interface TickerStatus {
  state: StateLevel;
  startedAt: string | null;
  lastTickAt: string | null;
}

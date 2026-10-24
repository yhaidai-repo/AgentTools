import type { TokenTotals } from "./TokenTotals";

export interface ModelUsage extends TokenTotals {
  model: string;
  costUsd: number;
  isPriced: boolean;
}

import type { UsageLabels } from "./UsageLabels";

export interface UsageQuery {
  from: Date;
  to?: Date;
  /** Only runs whose labels contain these. */
  match?: UsageLabels;
}

import type { UsageLabels } from "./UsageLabels";

export interface UsageQuery {
  from: Date;
  to?: Date;
  /** Only runs whose labels contain these. */
  match?: UsageLabels;
  /** Restrict to these record identities before limiting; an empty list matches nothing. */
  runIds?: readonly string[];
}

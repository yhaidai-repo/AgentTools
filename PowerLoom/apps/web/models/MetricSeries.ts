// One Prometheus range query's answer on a step grid from `from` to `to`; null where a step has no sample (PowerLoom
// or the PC was off).
export interface MetricSeries {
  /** Unix seconds of each step. */
  times: number[];
  values: (number | null)[];
}

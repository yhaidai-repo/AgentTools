import type { DayActivity } from "./DayActivity";

// What the per-day chart stacks by agent: how to read one agent's share off a day and how to print it.
export interface AgentMetric {
  label: string;
  /** The chart's title, e.g. "Cost per day". */
  title: string;
  byAgent: (day: DayActivity) => Record<string, number>;
  format: (value: number) => string;
}

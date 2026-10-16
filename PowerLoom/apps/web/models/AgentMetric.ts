import type { AgentDay } from "./AgentDay";

// What the agent chart shows per day: how to read it off a day and how to print it.
export interface AgentMetric {
  label: string;
  value: (day: AgentDay) => number;
  format: (value: number) => string;
}

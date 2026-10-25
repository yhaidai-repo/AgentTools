import type { HumanTaskQuery } from "./HumanTaskQuery";

// One step of a structured human task (user decision 2026-10-05).
export interface HumanTaskStep {
  action: string;
  source: "app-insights" | "log-analytics" | "cosmos" | "sql" | "portal" | "ado" | "other";
  /** The exact resource and environment, e.g. "App Insights orders-api (stage)". */
  resource: string;
  query: HumanTaskQuery | null;
  timeRange: string | null;
  /** What to paste back. */
  reportBack: string;
}

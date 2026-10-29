import type { components } from "@powerloom/client";
import { powerloom } from "./powerloom";

export type PerformanceHistory = components["schemas"]["PerformanceHistory"];

export async function loadApplicationPerformance(): Promise<PerformanceHistory | null> {
  try {
    const { data, response } = await powerloom.GET("/api/status/performance", { cache: "no-store" });
    return response.ok && data ? data : null;
  } catch {
    return null;
  }
}

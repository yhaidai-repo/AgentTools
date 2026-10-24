import type { components } from "@powerloom/client";
import { powerloom } from "./powerloom";

export type SystemStatus = components["schemas"]["SystemStatus"];
export type StateLevel = components["schemas"]["StateLevel"];
export type Attention = components["schemas"]["Attention"];

// PowerLoom's view of the running system (the dashboard's Application tab). Null when PowerLoom itself doesn't answer:
// the page shows that instead of failing.
export async function loadSystemStatus(): Promise<SystemStatus | null> {
  try {
    const { data } = await powerloom.GET("/api/status");

    return data ?? null;
  } catch {
    return null;
  }
}

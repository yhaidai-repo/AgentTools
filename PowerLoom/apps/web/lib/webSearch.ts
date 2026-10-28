import type { components } from "@powerloom/client";
import { powerloom } from "@/lib/powerloom";

export type WebSearchSetting = components["schemas"]["WebSearchSetting"];

// Settings → Data access → Web search (one for the whole PowerLoom); null while PowerLoom isn't reachable.
export async function loadWebSearch(): Promise<WebSearchSetting | null> {
  const { data } = await powerloom.GET("/api/web-search");

  return data ?? null;
}

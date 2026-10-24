import type { CatalogModel } from "@agenttools/config";
import type { components } from "@powerloom/client";
import { powerloom } from "@/lib/powerloom";

export type ProviderStatus = components["schemas"]["ProviderStatus"];
export type ChatApps = components["schemas"]["ChatApps"];

// Settings → AI providers (one for the whole PowerLoom): whether each provider is connected; null while PowerLoom isn't
// reachable.
export async function loadAiProviders(): Promise<ProviderStatus[] | null> {
  const { data } = await powerloom.GET("/api/ai-providers");

  return data ?? null;
}

export async function loadChatApps(): Promise<ChatApps | null> {
  const { data } = await powerloom.GET("/api/chats/apps");

  return data ?? null;
}

// The Agents page offers only connected providers' models; every model while PowerLoom can't say (nothing to hide by
// guessing).
export function connectedModels(catalog: CatalogModel[], providers: ProviderStatus[] | null): CatalogModel[] {
  if (!providers) {
    return catalog;
  }

  const connected = new Set(providers.filter((provider) => provider.connected).map((provider) => provider.provider));

  return catalog.filter((entry) => connected.has(entry.provider));
}

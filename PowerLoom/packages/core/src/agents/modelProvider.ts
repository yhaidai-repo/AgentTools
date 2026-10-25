import { modelCatalog, type CatalogModel } from "@agenttools/config";

/** The provider that runs a model: the catalog's, or the given one for a model the catalog doesn't list. A Codex model
 *  saved with provider anthropic would run on the wrong runtime, so whoever saves an agent's model takes it from here. */
export function providerOfModel(model: string, fallback: string, catalog: CatalogModel[] = modelCatalog()): string {
  return catalog.find((entry) => entry.model === model)?.provider ?? fallback;
}

/** An agent's model with the provider that runs it. */
export function withModelProvider<T extends { provider: string; model: string }>(chosen: T): T {
  return { ...chosen, provider: providerOfModel(chosen.model, chosen.provider) };
}

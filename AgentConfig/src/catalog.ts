import type { CatalogModel } from "./models/CatalogModel";
import { BUNDLED_MODELS } from "./modelCatalogData";

// Bundled model choices plus the host's additions (e.g. models of a provider it registered).
export function modelCatalog(extra: CatalogModel[] = []): CatalogModel[] {
  return [...BUNDLED_MODELS, ...extra];
}

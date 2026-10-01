import type { CatalogModel } from "./models/CatalogModel";

// Choices offered by clients (e.g. a model dropdown). Data, not rules: any provider/model can still be
// configured, the host decides which providers it can run, and hosts add their own via modelCatalog(extra).
export const BUNDLED_MODELS: CatalogModel[] = [
  { provider: "anthropic", model: "claude-opus-5-5", label: "Claude Opus 5.5" },
  { provider: "anthropic", model: "claude-fable-5-1", label: "Claude Fable 5.1" },
  { provider: "anthropic", model: "claude-opus-5", label: "Claude Opus 5" },
  { provider: "anthropic", model: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { provider: "anthropic", model: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
];

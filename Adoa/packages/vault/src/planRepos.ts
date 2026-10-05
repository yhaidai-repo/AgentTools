import type { DesignNote } from "./models/DesignNote";

// The repos an implementation touches: the ones the design's plan steps name (user decision 2026-10-05), in plan order.
export function planRepos(plan: DesignNote["plan"]): string[] {
  return [...new Set(plan.map((step) => step.repo.trim()).filter(Boolean))];
}

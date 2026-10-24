import { loadPromptVersions as loadPromptVersionsOf, type PromptVersionRow } from "@powerloom/core";
import { getDb } from "./db";

export type { PromptVersionRow } from "@powerloom/core";

// The stored prompt versions (core's query with the web's database); agent.update and agent.delete write them.
export function loadPromptVersions(agentId: string): Promise<PromptVersionRow[]> {
  return loadPromptVersionsOf(getDb(), agentId);
}

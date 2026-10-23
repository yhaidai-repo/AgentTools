import type { AgentDefinition } from "@agenttools/config";
import { readPromptFile } from "./promptFiles";

// The prompt as given: the file's own text = back on the file (nothing stored, also when a stored copy equals it);
// unchanged = the version stays; any other text = the next version (user decision 2026-10-23: every edit is a new
// version). Shared by the Config page's save and agent.update.
export async function withPromptVersion(next: AgentDefinition, current: AgentDefinition): Promise<AgentDefinition> {
  const file = await readPromptFile(current.id);
  const typed = (next.prompt ?? "").replace(/\r\n/g, "\n").trim();
  const stored = (current.prompt ?? "").trim();
  const version = current.promptVersion ?? 0;

  if (file && typed === file.text.trim()) {
    return { ...next, prompt: "", promptVersion: version };
  }

  if (typed === stored) {
    return { ...next, prompt: current.prompt ?? "", promptVersion: version };
  }

  return { ...next, prompt: typed, promptVersion: version + 1 };
}

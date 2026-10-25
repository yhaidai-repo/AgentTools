import type { AgentsGlobal } from "@agenttools/config";
import { readPromptFile } from "./promptFiles";

// The shared framework's prompt history is kept with the agents' (agent_prompt_version) under this id; agent ids start
// with a letter, so it never clashes.
export const FRAMEWORK_ID = "_framework";

// The framework as typed in Settings, versioned like an agent's prompt (user decision 2026-10-25: visible and editable
// there): the file's own text = back on the file; unchanged = the version stays; any other text = the next version.
export async function withFrameworkVersion(typed: string, current: AgentsGlobal): Promise<AgentsGlobal> {
  const file = await readPromptFile(FRAMEWORK_ID);
  const text = typed.replace(/\r\n/g, "\n").trim();
  const stored = (current.framework ?? "").trim();
  const version = current.frameworkVersion ?? 0;

  if (file && text === file.text.trim()) {
    return { ...current, framework: "", frameworkVersion: version };
  }

  if (text === stored) {
    return current;
  }

  return { ...current, framework: text, frameworkVersion: version + 1 };
}

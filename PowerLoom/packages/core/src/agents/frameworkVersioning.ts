import type { AgentsGlobal } from "@agenttools/config";
import { readPromptFile } from "./promptFiles";

// The shared framework's prompt history is kept with the agents' (agent_prompt_version) under this id; agent ids start
// with a letter, so it never clashes.
export const FRAMEWORK_ID = "_framework";

export interface FrameworkVersioning {
  global: AgentsGlobal;
  /** A history row to write for this version; false when the text, or the version, is already there. */
  writesHistory: boolean;
}

// The framework as typed in Settings, versioned like an agent's prompt (user decision 2026-10-25: visible and editable
// there): the file's own text = back on the file; unchanged = the version stays; any other text = the next version. The
// next number follows the history too, so a save whose settings write failed after its history row never blocks the
// next one: the same text again takes that row's version, another text the one after it.
export async function withFrameworkVersion(typed: string, current: AgentsGlobal, latest: { version: number; text: string } | null): Promise<FrameworkVersioning> {
  const file = await readPromptFile(FRAMEWORK_ID);
  const text = typed.replace(/\r\n/g, "\n").trim();
  const stored = (current.framework ?? "").trim();
  const version = current.frameworkVersion ?? 0;

  if (file && text === file.text.trim()) {
    return { global: { ...current, framework: "", frameworkVersion: version }, writesHistory: false };
  }

  if (text === stored) {
    return { global: current, writesHistory: false };
  }

  if (latest && latest.version > version && latest.text === text) {
    return { global: { ...current, framework: text, frameworkVersion: latest.version }, writesHistory: false };
  }

  return { global: { ...current, framework: text, frameworkVersion: Math.max(version, latest?.version ?? 0) + 1 }, writesHistory: true };
}

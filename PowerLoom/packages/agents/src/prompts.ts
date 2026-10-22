import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { LoadedPrompt } from "./models/LoadedPrompt";

const PROMPTS_DIR = new URL("../prompts/", import.meta.url);
const HEADER = /^<!--\s*prompt:[^>]*version:\s*([^\s·>]+)[^>]*-->\s*/;
const FRAMEWORK = "framework";
const FRAMEWORK_PLACEHOLDER = /\{\{\s*framework\s*\}\}/;

type ReadFragment = (name: string) => Promise<string>;

// Prompts are versioned files in the repo; `{{name}}` placeholders are filled from `values`.
export async function loadPrompt(name: string, values: Record<string, string>): Promise<LoadedPrompt> {
  return composePrompt(await readPromptFile(name), values, readPromptFile);
}

// An agent's prompt: the one stored with its definition when it has one (user decision 2026-10-22: editable in the UI),
// else its prompt file, else nothing (a UI-created agent without instructions runs on the framework alone). A stored
// prompt is versioned by its content, so a run records which text it ran on.
export async function loadAgentPrompt(agentId: string, storedPrompt: string, values: Record<string, string>): Promise<LoadedPrompt> {
  if (storedPrompt.trim()) {
    return composePrompt(`<!-- prompt: ${agentId} · version: stored.${contentVersion(storedPrompt)} -->\n${storedPrompt}`, values, readPromptFile);
  }

  if (await hasPromptFile(agentId)) {
    return loadPrompt(agentId, values);
  }

  return composePrompt(`<!-- prompt: ${agentId} · version: none -->\n{{framework}}`, values, readPromptFile);
}

export async function hasPromptFile(name: string): Promise<boolean> {
  try {
    await access(fileURLToPath(new URL(`${name}.md`, PROMPTS_DIR)));

    return true;
  } catch {
    return false;
  }
}

function contentVersion(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 8);
}

// `{{framework}}` pulls in the shared `_framework.md`; its version joins the prompt's, so a run records both.
export async function composePrompt(raw: string, values: Record<string, string>, readFragment: ReadFragment): Promise<LoadedPrompt> {
  const prompt = parsePrompt(raw);

  if (!FRAMEWORK_PLACEHOLDER.test(prompt.text)) {
    return { text: fillPlaceholders(prompt.text, values), version: prompt.version };
  }

  const framework = parsePrompt(await readFragment(`_${FRAMEWORK}`));
  const text = fillPlaceholders(prompt.text, { ...values, [FRAMEWORK]: framework.text.trim() });

  return { text, version: `${prompt.version}+${FRAMEWORK}.${framework.version}` };
}

function parsePrompt(raw: string): LoadedPrompt {
  return { text: raw.replace(HEADER, ""), version: HEADER.exec(raw)?.[1] ?? "unversioned" };
}

function fillPlaceholders(text: string, values: Record<string, string>): string {
  return text.replaceAll(/\{\{\s*(\w+)\s*\}\}/g, (placeholder, key: string) => values[key] ?? placeholder);
}

function readPromptFile(name: string): Promise<string> {
  return readFile(fileURLToPath(new URL(`${name}.md`, PROMPTS_DIR)), "utf8");
}

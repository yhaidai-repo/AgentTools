import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { LoadedPrompt } from "./models/LoadedPrompt";

const PROMPTS_DIR = new URL("../prompts/", import.meta.url);
const HEADER = /^<!--\s*prompt:[^>]*version:\s*([^\s·>]+)[^>]*-->\s*/;
const FRAMEWORK = "framework";
const FRAMEWORK_PLACEHOLDER = /\{\{\s*framework\s*\}\}/;

type ReadFragment = (name: string) => Promise<string>;

/** A prompt as stored in the agent store: empty text = the file shipped with the code applies. */
export interface StoredPrompt {
  text: string;
  version: number;
}

// Prompts are versioned files in the repo; `{{name}}` placeholders are filled from `values`.
export async function loadPrompt(name: string, values: Record<string, string>): Promise<LoadedPrompt> {
  return composePrompt(await readPromptFile(name), values, readPromptFile);
}

// An agent's prompt: the one stored with its definition when it has one (user decision 2026-10-22: editable in the UI;
// every edit a new version, 2026-10-23), else its prompt file, else nothing (a UI-created agent without instructions
// runs on the framework alone). A run records the version it ran on: a stored one as ui-v<N>, apart from the files' v<N>.
// The framework works the same way (Settings → Agents, user decision 2026-10-25): the stored one, else `_framework.md`.
export async function loadAgentPrompt(agentId: string, stored: StoredPrompt, values: Record<string, string>, framework?: StoredPrompt): Promise<LoadedPrompt> {
  const readFragment = withStoredFramework(framework);

  if (stored.text.trim()) {
    return composePrompt(`<!-- prompt: ${agentId} · version: ui-v${stored.version} -->\n${stored.text}`, values, readFragment);
  }

  if (await hasPromptFile(agentId)) {
    return composePrompt(await readPromptFile(agentId), values, readFragment);
  }

  return composePrompt(`<!-- prompt: ${agentId} · version: none -->\n{{framework}}`, values, readFragment);
}

function withStoredFramework(framework: StoredPrompt | undefined): ReadFragment {
  if (!framework?.text.trim()) {
    return readPromptFile;
  }

  return async (name) => (name === `_${FRAMEWORK}` ? `<!-- prompt: ${FRAMEWORK} · version: ui-v${framework.version} -->\n${framework.text}` : readPromptFile(name));
}

export async function hasPromptFile(name: string): Promise<boolean> {
  try {
    await access(fileURLToPath(new URL(`${name}.md`, PROMPTS_DIR)));

    return true;
  } catch {
    return false;
  }
}

// The prompt file as the code ships it, with LF line ends so a Windows checkout isn't a change; null without a file.
export async function shippedPromptText(name: string): Promise<string | null> {
  if (!(await hasPromptFile(name))) {
    return null;
  }

  return (await readPromptFile(name)).replace(/\r\n/g, "\n");
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

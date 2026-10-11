import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { LoadedPrompt } from "./models/LoadedPrompt";

const PROMPTS_DIR = new URL("../prompts/", import.meta.url);
const HEADER = /^<!--\s*prompt:[^>]*version:\s*([^\s·>]+)[^>]*-->\s*/;

// Prompts are versioned files in the repo; `{{name}}` placeholders are filled from `values`.
export async function loadPrompt(name: string, values: Record<string, string>): Promise<LoadedPrompt> {
  const raw = await readFile(fileURLToPath(new URL(`${name}.md`, PROMPTS_DIR)), "utf8");
  const version = HEADER.exec(raw)?.[1] ?? "unversioned";
  const body = raw.replace(HEADER, "");
  const text = body.replaceAll(/\{\{\s*(\w+)\s*\}\}/g, (placeholder, key: string) => values[key] ?? placeholder);

  return { text, version };
}

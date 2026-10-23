import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PromptFile } from "../models/PromptFile";

const HEADER = /^<!--\s*prompt:[^>]*version:\s*([^\s·>]+)[^>]*-->\s*/;
// The agent-runner's prompt files, as the image lays them out (/app/PowerLoom/packages/agents/prompts) and as a local
// `npm run dev` from apps/web sees them.
const CANDIDATE_ROOTS = ["PowerLoom/packages/agents/prompts", "../../packages/agents/prompts"];

// The prompt file shipped with the code for an agent, or null when it has none (an agent created in the UI).
export async function readPromptFile(agentId: string): Promise<PromptFile | null> {
  for (const root of CANDIDATE_ROOTS) {
    const path = resolve(process.cwd(), root, `${agentId}.md`);

    if (await exists(path)) {
      return parse(await readFile(path, "utf8"));
    }
  }

  return null;
}

// The text as a textarea submits it (LF): the files are checked out with CRLF on Windows, and an unchanged prompt must
// compare equal to the file, so the agent stays on the file instead of getting a stored copy.
function parse(raw: string): PromptFile {
  const text = raw.replace(/\r\n/g, "\n");

  return { text: text.replace(HEADER, ""), version: HEADER.exec(text)?.[1] ?? "unversioned" };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);

    return true;
  } catch {
    return false;
  }
}

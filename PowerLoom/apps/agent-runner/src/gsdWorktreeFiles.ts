import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const EXCLUDED = [".planning/", ".claude/"];

export async function createPlanningFolder(worktree: string): Promise<string> {
  const folder = join(worktree, ".planning");

  await mkdir(folder, { recursive: true });

  return folder;
}

/** Keeps every key already in config.json; only `commit_docs` is forced to false. */
export async function disableCommitDocs(planningFolder: string): Promise<void> {
  const file = join(planningFolder, "config.json");
  const config = await readJsonObject(file);

  if (config.commit_docs === false) {
    return;
  }

  await writeFile(file, `${JSON.stringify({ ...config, commit_docs: false }, null, 2)}\n`, "utf8");
}

export async function appendMissingExcludes(excludeFile: string): Promise<void> {
  const text = await readOrEmpty(excludeFile);
  const present = new Set(text.split(/\r?\n/).map((line) => line.trim()));
  const missing = EXCLUDED.filter((pattern) => !present.has(pattern));

  if (missing.length === 0) {
    return;
  }

  const separator = text === "" || text.endsWith("\n") ? "" : "\n";

  await mkdir(join(excludeFile, ".."), { recursive: true });
  await writeFile(excludeFile, `${text}${separator}${missing.join("\n")}\n`, "utf8");
}

async function readJsonObject(file: string): Promise<Record<string, unknown>> {
  const text = await readOrEmpty(file);

  if (text.trim() === "") {
    return {};
  }

  const parsed: unknown = JSON.parse(text);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${file} is not a JSON object.`);
  }

  return parsed as Record<string, unknown>;
}

async function readOrEmpty(file: string): Promise<string> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

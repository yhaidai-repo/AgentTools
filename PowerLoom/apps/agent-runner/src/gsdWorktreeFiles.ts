import type { GsdSeedFile } from "@agenttools/runtime";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export async function createPlanningFolder(worktree: string): Promise<string> {
  const folder = join(worktree, ".planning");

  await mkdir(folder, { recursive: true });

  return folder;
}

/** Keeps every key already in config.json and merges the seed's over it, one level deep (a seeded `workflow` switch keeps
 *  the other `workflow` keys); `commit_docs` is always false. Unchanged settings leave the file as it was. */
export async function writePlanningConfig(planningFolder: string, seed: Record<string, unknown>): Promise<void> {
  const file = join(planningFolder, "config.json");
  const text = await readOrEmpty(file);
  const config = parseJsonObject(file, text);
  const merged = { ...mergeOneLevel(config, seed), commit_docs: false };
  const isUnchanged = text.trim() !== "" && JSON.stringify(merged) === JSON.stringify(config);

  if (isUnchanged) {
    return;
  }

  await writeFile(file, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
}

/** Writes each seed file inside the planning folder; a path that leaves the folder is refused before anything is written. */
export async function writeSeedFiles(planningFolder: string, files: GsdSeedFile[]): Promise<void> {
  const targets = files.map((file) => ({ path: insideFolder(planningFolder, file.path), content: file.content }));

  for (const target of targets) {
    await mkdir(dirname(target.path), { recursive: true });
    await writeFile(target.path, target.content, "utf8");
  }
}

/** A folder-local .gitignore of `*` hides the folder and itself without touching the repo's own ignore files. */
export async function ignoreFolderContents(folder: string): Promise<void> {
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, ".gitignore"), "*\n", "utf8");
}

function parseJsonObject(file: string, text: string): Record<string, unknown> {
  if (text.trim() === "") {
    return {};
  }

  const parsed: unknown = JSON.parse(text);

  if (!isPlainObject(parsed)) {
    throw new Error(`${file} is not a JSON object.`);
  }

  return parsed;
}

function mergeOneLevel(config: Record<string, unknown>, seed: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...config };

  for (const [key, value] of Object.entries(seed)) {
    const current = config[key];

    merged[key] = isPlainObject(current) && isPlainObject(value) ? { ...current, ...value } : value;
  }

  return merged;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function insideFolder(folder: string, path: string): string {
  const target = resolve(folder, path);
  const fromFolder = relative(resolve(folder), target);

  if (fromFolder === "" || fromFolder.startsWith("..") || isAbsolute(fromFolder)) {
    throw new Error(`The GSD seed file "${path}" is not inside .planning/.`);
  }

  return target;
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

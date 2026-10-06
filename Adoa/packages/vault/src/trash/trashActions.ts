import { access, mkdir, rename, rm } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { TRASH_FOLDER } from "./listTrash";

// Puts a trashed file back where it was; refused when a note is there again, so nothing is overwritten.
export async function restoreFromTrash(vaultRoot: string, path: string): Promise<string> {
  const relative = safePath(path);
  const target = join(vaultRoot, relative);

  if (await exists(target)) {
    throw new Error(`${relative} exists in the vault again; delete or move it first`);
  }

  await mkdir(dirname(target), { recursive: true });
  await rename(join(vaultRoot, TRASH_FOLDER, relative), target);

  return relative;
}

export async function deleteFromTrash(vaultRoot: string, path: string): Promise<string> {
  const relative = safePath(path);

  await rm(join(vaultRoot, TRASH_FOLDER, relative), { force: true });

  return relative;
}

// Only paths inside .trash/: no absolute paths, no `..`.
function safePath(path: string): string {
  const relative = normalize(path).replaceAll("\\", "/").replace(/^\/+/, "");

  if (!relative || relative.split("/").includes("..")) {
    throw new Error(`not a path inside the trash: ${path}`);
  }

  return relative;
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

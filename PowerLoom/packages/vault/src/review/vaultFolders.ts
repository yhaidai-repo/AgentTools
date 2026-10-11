import { access, readdir } from "node:fs/promises";
import { join } from "node:path";

// The Obsidian vaults under the vaults root (folders with `.obsidian`), without the excluded ones (PowerLoom's backlog vault,
// which only the renderer writes).
export async function listVaults(vaultsDir: string, excluded: string[]): Promise<string[]> {
  const entries = await readdir(vaultsDir, { withFileTypes: true }).catch(() => []);
  const folders = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !excluded.includes(entry.name)).map((entry) => entry.name);
  const isVault = await Promise.all(folders.map((folder) => hasObsidianFolder(join(vaultsDir, folder))));

  return folders.filter((_, index) => isVault[index]).sort();
}

async function hasObsidianFolder(folder: string): Promise<boolean> {
  try {
    await access(join(folder, ".obsidian"));

    return true;
  } catch {
    return false;
  }
}

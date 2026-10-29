import { readdir } from "node:fs/promises";

// The folders of the vaults root that aren't vaults yet: what the vaults dialog offers to add. An unreadable root
// (not mounted) offers none; the folder can still be typed.
export async function freeVaultFolders(vaults: string[]): Promise<string[]> {
  try {
    const entries = await readdir(process.env.VAULTS_DIR ?? "/vaults", { withFileTypes: true });

    return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !vaults.includes(entry.name)).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

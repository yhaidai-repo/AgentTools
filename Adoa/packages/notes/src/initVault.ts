import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

// What a vault needs for adoa's maintenance (user decision 2026-10-05): rules and registers from the templates, the
// drafts folder (VaultCapture), the usage log folder (VaultUsage) and Obsidian's folder, so the vault is listed as one.
// Agent-app files (Claude's CLAUDE.md) are the app's own: "Configure with <agent>" creates them (2026-10-06).
const FOLDERS = ["draft", ".usage", ".obsidian"];

// Creates whatever is missing in the vault's folder; existing files are never touched. Returns what was created, as
// paths relative to the vault. `hostPath` is the vault's path on the PC, written into the templates ({{vaultPath}}).
export async function initVault(vaultRoot: string, templateHome: string, hostPath: string): Promise<string[]> {
  const created: string[] = [];

  await mkdir(vaultRoot, { recursive: true });

  for (const folder of FOLDERS) {
    created.push(...await createFolder(vaultRoot, folder));
  }

  for (const file of await readdir(templateHome)) {
    created.push(...await createFromTemplate(vaultRoot, templateHome, file, hostPath));
  }

  return created;
}

async function createFolder(vaultRoot: string, folder: string): Promise<string[]> {
  if (await exists(join(vaultRoot, folder))) {
    return [];
  }

  await mkdir(join(vaultRoot, folder), { recursive: true });

  return [`${folder}/`];
}

async function createFromTemplate(vaultRoot: string, templateHome: string, file: string, hostPath: string): Promise<string[]> {
  if (await exists(join(vaultRoot, file))) {
    return [];
  }

  const template = await readFile(join(templateHome, file), "utf8");
  const content = template.replaceAll("{{vaultPath}}", hostPath).replaceAll("{{date}}", new Date().toISOString().slice(0, 10));

  await writeFile(join(vaultRoot, file), content, "utf8");

  return [file];
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false);
}

import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

// The project's repository as its index note names it (`repo: D:/Projects/PVS` or `repo: D:/Projects/AgentTools (folder Adoa/)`);
// the folder name is the repo's name in the catalog. Null when the project has no index or no repo.
export async function projectRepoName(docsRoot: string, project: string): Promise<string | null> {
  const index = await readFile(join(docsRoot, project, `${project}-index.md`), "utf8").catch(() => null);
  const repoLine = index?.match(/^repo:\s*(.+)$/m)?.[1];
  const path = repoLine?.replace(/\(folder[^)]*\)/, "").trim().replace(/["']/g, "").replace(/[\\/]+$/, "");

  return path ? basename(path.replaceAll("\\", "/")) : null;
}

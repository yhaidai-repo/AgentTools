import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

const REPOS_COLUMN = "repos";

// The project's repository as its index note names it (`repo: D:/Projects/PVS` or `repo: D:/Projects/AgentTools (folder PowerLoom/)`);
// the folder name is the repo's name in the catalog. Null when the project has no index or no repo.
export async function projectRepoName(docsRoot: string, project: string): Promise<string | null> {
  const index = await readFile(join(docsRoot, project, `${project}-index.md`), "utf8").catch(() => null);
  const repoLine = index?.match(/^repo:\s*(.+)$/m)?.[1];
  const path = repoLine?.replace(/\(folder[^)]*\)/, "").trim().replace(/["']/g, "").replace(/[\\/]+$/, "");

  return path ? basename(path.replaceAll("\\", "/")) : null;
}

// Every repo the vault documents, keyed by lower-case repo name, with where it is written (e.g. "pvs.internal" →
// "pvsi index", "pvs.integrationevents" → "pvsi-repos"): each project's index `repo:` line and its `<key>-repos` note
// (user decision 2026-10-02). Projects are the top-level folders.
export async function documentedRepos(docsRoot: string): Promise<Map<string, string>> {
  const entries = await readdir(docsRoot, { withFileTypes: true }).catch(() => []);
  const projects = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name);
  const perProject = await Promise.all(projects.map((project) => projectRepos(docsRoot, project)));
  const fromIndexesFirst = [...perProject.flat()].sort((a, b) => Number(b[1].endsWith(" index")) - Number(a[1].endsWith(" index")));

  // The first place wins: a repo's own project index over another project's table.
  return fromIndexesFirst.reduce((repos, [name, source]) => (repos.has(name) ? repos : repos.set(name, source)), new Map<string, string>());
}

async function projectRepos(docsRoot: string, project: string): Promise<[string, string][]> {
  const indexRepo = await projectRepoName(docsRoot, project);
  const featureRepos = await featureRepoNames(docsRoot, project);
  const fromIndex: [string, string][] = indexRepo ? [[indexRepo.toLowerCase(), `${project} index`]] : [];

  return [...fromIndex, ...featureRepos.map((name): [string, string] => [name.toLowerCase(), `${project}-repos`])];
}

// The **Repos** column of the `<key>-repos` table: comma-separated catalog names per feature row.
async function featureRepoNames(docsRoot: string, project: string): Promise<string[]> {
  const note = await readFile(join(docsRoot, project, `${project}-repos.md`), "utf8").catch(() => "");
  const rows = note.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("|")).map(tableCells);
  const column = rows[0]?.findIndex((cell) => cell.toLowerCase() === REPOS_COLUMN) ?? -1;

  if (column < 0) {
    return [];
  }

  return rows.slice(1).filter((cells) => !isSeparator(cells)).flatMap((cells) => (cells[column] ?? "").split(",").map((name) => name.trim()).filter(Boolean));
}

function tableCells(line: string): string[] {
  return line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function isSeparator(cells: string[]): boolean {
  return cells.every((cell) => /^:?-+:?$/.test(cell));
}

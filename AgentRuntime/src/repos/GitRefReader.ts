import { join } from "node:path";
import type { RepoRefReader } from "../models/RepoRefReader";
import type { ResolvedRef } from "../models/ResolvedRef";

type Git = (args: string[], cwd: string) => Promise<string>;

const COMMIT_ID = /^[0-9a-f]{7,40}$/i;
const FETCHED_PREFIX = "refs/powerloom/heads/";
const REFETCH_MS = 5 * 60_000;

// Other branches are fetched on demand into refs/powerloom/heads/*, never into the checkout, so a run reading a branch
// can't move the files another run reads. Blobs of the partial clone download as they are read.
export class GitRefReader implements RepoRefReader {
  private readonly fetchedAt = new Map<string, number>();

  constructor(
    private readonly root: string,
    private readonly git: Git,
  ) {}

  async listBranches(repo: string, filter: string): Promise<string[]> {
    const output = await this.git(["ls-remote", "--heads", "origin"], this.path(repo));
    const names = output.split("\n").filter(Boolean).map((line) => line.split("\t")[1].replace("refs/heads/", ""));
    const wanted = filter.toLowerCase();

    return names.filter((name) => name.toLowerCase().includes(wanted)).sort();
  }

  async resolve(repo: string, ref: string): Promise<ResolvedRef> {
    requireSafeRef(ref);

    if (COMMIT_ID.test(ref)) {
      return { ref, commit: await this.commitOf(repo, ref) };
    }

    await this.fetchBranch(repo, ref);

    return { ref, commit: await this.commitOf(repo, `${FETCHED_PREFIX}${ref}`) };
  }

  async listTree(repo: string, commit: string, path: string): Promise<string[]> {
    const output = await this.git(["ls-tree", `${commit}:${path}`], this.path(repo));

    return output.split("\n").filter(Boolean).map(treeEntryName).sort();
  }

  show(repo: string, commit: string, path: string): Promise<string> {
    return this.git(["show", `${commit}:${path}`], this.path(repo));
  }

  async grep(repo: string, commit: string, query: string, glob?: string): Promise<string[]> {
    const pathspec = glob ? ["--", glob] : [];
    const output = await this.git(["grep", "-n", "-I", "-i", "--fixed-strings", "-e", query, commit, ...pathspec], this.path(repo)).catch(noMatches);

    return output.split("\n").filter(Boolean).map((line) => line.slice(commit.length + 1));
  }

  log(repo: string, commit: string, path: string, limit: number): Promise<string> {
    return this.git(["log", `-n${limit}`, "--date=short", "--pretty=format:%h %ad %an: %s", commit, "--", path || "."], this.path(repo));
  }

  diff(repo: string, base: string, head: string, path?: string): Promise<string> {
    return this.git(["diff", "--no-color", "--no-ext-diff", "--find-renames", "--unified=3", base, head, "--", ...(path ? [path] : [])], this.path(repo));
  }

  private async fetchBranch(repo: string, branch: string): Promise<void> {
    const key = `${repo}:${branch}`;

    if (Date.now() - (this.fetchedAt.get(key) ?? 0) < REFETCH_MS) {
      return;
    }

    await this.git(["fetch", "origin", `+refs/heads/${branch}:${FETCHED_PREFIX}${branch}`], this.path(repo));
    this.fetchedAt.set(key, Date.now());
  }

  private async commitOf(repo: string, ref: string): Promise<string> {
    return (await this.git(["rev-parse", "--verify", `${ref}^{commit}`], this.path(repo))).trim();
  }

  private path(repo: string): string {
    return join(this.root, repo);
  }
}

// Arguments go to git without a shell, but a ref starting with '-' would still be read as an option.
function requireSafeRef(ref: string): void {
  if (!ref || ref.startsWith("-") || ref.includes("..") || /[\s~^:?*[\\]/.test(ref)) {
    throw new Error(`Not a branch name or commit id: ${ref}`);
  }
}

// `<mode> <type> <id>\t<name>`; folders end with '/'.
function treeEntryName(line: string): string {
  const [meta, name] = line.split("\t");

  return meta.split(" ")[1] === "tree" ? `${name}/` : name;
}

// git grep exits with 1 when nothing matches.
function noMatches(error: unknown): string {
  if (String(error).includes("exit code 1")) {
    return "";
  }

  throw error;
}

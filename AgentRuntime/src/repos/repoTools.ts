import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { defineTool } from "../defineTool";
import type { RepoRefReader } from "../models/RepoRefReader";
import type { RepoToolOptions } from "../models/RepoToolOptions";
import type { ResolvedRef } from "../models/ResolvedRef";
import type { ToolDefinition } from "../models/ToolDefinition";
import { resolveInside } from "../tools/safePath";
import { git, gitOrEmpty } from "./git";

const DEFAULT_READ_LINES = 400;
const DEFAULT_SEARCH_RESULTS = 60;
const MAX_LOG = 30;
const MAX_BRANCHES = 100;
const MAX_DIFF_CHARS = 60_000;

const refInput = z.string().optional().describe("A branch name or commit id to read instead of the checkout (the repo's default branch)");

// Read-only code tools over the repo cache. Paths start with the repo name: "<repo>/src/file.ts". With `refs`, every tool
// can read another branch or commit, and list_branches / git_diff are added.
export function createRepoTools(options: RepoToolOptions): ToolDefinition<any>[] {
  const tools = [listFilesTool(options), readFileTool(options), searchCodeTool(options), gitLogTool(options)];

  return options.refs ? [...tools, listBranchesTool(options, options.refs), gitDiffTool(options, options.refs)] : tools;
}

function listFilesTool(options: RepoToolOptions) {
  return defineTool({
    name: "list_files",
    description: `List a folder in the repos. '' lists the repos: ${options.repos.join(", ")}. Folders end with '/'.`,
    input: { path: z.string().default("").describe("'<repo>/<folder>' or ''"), ref: refInput },
    handler: async ({ path, ref }) => {
      if (!path) {
        return { text: options.repos.map((repo) => `${repo}/`).join("\n") };
      }

      if (ref) {
        return atRef(options, path, ref, async (repo, resolved, inner) => (await refs(options).listTree(repo, resolved.commit, inner)).join("\n") || "(empty)");
      }

      const entries = await readdir(resolveRepoPath(options, path), { withFileTypes: true });
      const lines = entries.filter((entry) => entry.name !== ".git").map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));

      return { text: lines.sort().join("\n") || "(empty)" };
    },
  });
}

function readFileTool(options: RepoToolOptions) {
  const maxLines = options.maxReadLines ?? DEFAULT_READ_LINES;

  return defineTool({
    name: "read_file",
    description: `Read a source file. Returns up to ${maxLines} lines from 'offset' (0-based), with line numbers.`,
    input: {
      path: z.string().describe("'<repo>/<path to file>'"),
      offset: z.number().int().min(0).default(0),
      ref: refInput,
    },
    handler: async ({ path, offset, ref }) => {
      if (ref) {
        return atRef(options, path, ref, async (repo, resolved, inner) => pageOf(await refs(options).show(repo, resolved.commit, inner), offset, maxLines));
      }

      return { text: pageOf(await readFile(resolveRepoPath(options, path), "utf8"), offset, maxLines) };
    },
  });
}

function searchCodeTool(options: RepoToolOptions) {
  const maxResults = options.maxSearchResults ?? DEFAULT_SEARCH_RESULTS;

  return defineTool({
    name: "search_code",
    description: `Case-insensitive text search in tracked files (git grep). Returns up to ${maxResults} '<repo>/<path>:<line>: text' matches.`,
    input: {
      query: z.string().min(2).describe("Text to find (plain text, not a regex)"),
      repo: z.string().optional().describe("Limit to one repo; required with ref"),
      glob: z.string().optional().describe("Limit to files matching a pathspec, e.g. '*.cs'"),
      ref: refInput,
    },
    handler: async ({ query, repo, glob, ref }) => {
      const lines = ref ? await searchAtRef(options, query, repo, glob, ref) : await searchCheckouts(options, query, repo, glob);
      const more = lines.length > maxResults ? `\n… ${lines.length - maxResults} more matches; narrow the search.` : "";

      return { text: (lines.slice(0, maxResults).join("\n") || "No matches.") + more };
    },
  });
}

function gitLogTool(options: RepoToolOptions) {
  return defineTool({
    name: "git_log",
    description: `Recent commits touching a file or folder (newest first, up to ${MAX_LOG}).`,
    input: {
      path: z.string().describe("'<repo>' or '<repo>/<path>'"),
      limit: z.number().int().min(1).max(MAX_LOG).default(10),
      ref: refInput,
    },
    handler: async ({ path, limit, ref }) => {
      if (ref) {
        return atRef(options, path, ref, async (repo, resolved, inner) => (await refs(options).log(repo, resolved.commit, inner, limit)) || "No commits.");
      }

      const [repo, ...rest] = path.split("/");
      const repoRoot = resolveRepoPath(options, allowedRepo(options, repo));
      const output = await git(["log", `-n${limit}`, "--date=short", "--pretty=format:%h %ad %an: %s", "--", rest.join("/") || "."], repoRoot);

      return { text: output || "No commits." };
    },
  });
}

function listBranchesTool(options: RepoToolOptions, reader: RepoRefReader) {
  return defineTool({
    name: "list_branches",
    description: `Branches of a repo on its remote whose name contains 'filter' (up to ${MAX_BRANCHES}), e.g. a PBI id to find its feature branch.`,
    input: {
      repo: z.string().describe("The repo"),
      filter: z.string().default("").describe("Part of the branch name, e.g. '36756'"),
    },
    handler: async ({ repo, filter }) => {
      const branches = await reader.listBranches(allowedRepo(options, repo), filter);
      const more = branches.length > MAX_BRANCHES ? `\n… ${branches.length - MAX_BRANCHES} more; narrow the filter.` : "";

      return { text: (branches.slice(0, MAX_BRANCHES).join("\n") || "No matching branches.") + more };
    },
  });
}

function gitDiffTool(options: RepoToolOptions, reader: RepoRefReader) {
  return defineTool({
    name: "git_diff",
    description: "The changes between two branches or commits of a repo (unified diff), optionally for one file or folder, e.g. what a feature branch changed against the default branch.",
    input: {
      repo: z.string().describe("The repo"),
      base: z.string().describe("Branch or commit to compare from, e.g. the default branch"),
      head: z.string().describe("Branch or commit to compare to, e.g. the feature branch"),
      path: z.string().optional().describe("A file or folder inside the repo, without the repo name"),
    },
    handler: async ({ repo, base, head, path }) => {
      const name = allowedRepo(options, repo);
      const [from, to] = await Promise.all([reader.resolve(name, base), reader.resolve(name, head)]);
      const diff = await reader.diff(name, from.commit, to.commit, path);
      const cut = diff.length > MAX_DIFF_CHARS ? `\n… diff cut at ${MAX_DIFF_CHARS} characters; give a path to see the rest.` : "";

      return { text: `[${name} ${label(from)} → ${label(to)}]\n${diff.slice(0, MAX_DIFF_CHARS) || "No changes."}${cut}` };
    },
  });
}

// Reads `<repo>/<path>` at a branch or commit; the result names the commit it read, so evidence points at the right code.
async function atRef(options: RepoToolOptions, path: string, ref: string, read: (repo: string, resolved: ResolvedRef, inner: string) => Promise<string>) {
  const [repo, ...rest] = path.split("/");
  const name = allowedRepo(options, repo);
  const resolved = await refs(options).resolve(name, ref);

  return { text: `[${name}@${label(resolved)}]\n${await read(name, resolved, rest.join("/"))}` };
}

async function searchAtRef(options: RepoToolOptions, query: string, repo: string | undefined, glob: string | undefined, ref: string): Promise<string[]> {
  if (!repo) {
    throw new Error("search_code with ref needs repo: a branch or commit belongs to one repo.");
  }

  const name = allowedRepo(options, repo);
  const resolved = await refs(options).resolve(name, ref);
  const matches = await refs(options).grep(name, resolved.commit, query, glob);

  return [`[${name}@${label(resolved)}]`, ...matches.map((line) => `${name}/${line.slice(0, 240)}`)];
}

async function searchCheckouts(options: RepoToolOptions, query: string, repo: string | undefined, glob: string | undefined): Promise<string[]> {
  const repos = repo ? [allowedRepo(options, repo)] : options.repos;
  const results = await Promise.all(repos.map((name) => grepRepo(options.root, name, query, glob)));

  return results.flat();
}

function pageOf(content: string, offset: number, maxLines: number): string {
  const lines = content.split(/\r?\n/);
  const page = lines.slice(offset, offset + maxLines).map((line, index) => `${offset + index + 1}: ${line}`);
  const rest = lines.length - offset - page.length;
  const footer = rest > 0 ? `\n… ${rest} more lines; call again with offset ${offset + page.length}.` : "";

  return page.join("\n") + footer;
}

function label(resolved: ResolvedRef): string {
  return `${resolved.ref} ${resolved.commit.slice(0, 10)}`;
}

function refs(options: RepoToolOptions): RepoRefReader {
  if (!options.refs) {
    throw new Error("Reading another branch or commit isn't available to this agent.");
  }

  return options.refs;
}

async function grepRepo(root: string, repo: string, query: string, glob?: string): Promise<string[]> {
  const pathspec = glob ? ["--", glob] : [];
  const output = await gitOrEmpty(["grep", "-n", "-I", "-i", "--fixed-strings", "-e", query, ...pathspec], join(root, repo));

  return output.split("\n").filter(Boolean).map((line) => `${repo}/${line.slice(0, 240)}`);
}

function resolveRepoPath(options: RepoToolOptions, path: string): string {
  const repo = path.split("/")[0];

  allowedRepo(options, repo);

  return resolveInside(join(options.root, repo), path.slice(repo.length + 1) || ".");
}

function allowedRepo(options: RepoToolOptions, repo: string): string {
  if (!options.repos.includes(repo)) {
    throw new Error(`Repo not available to this agent: ${repo}. Available: ${options.repos.join(", ")}`);
  }

  return repo;
}

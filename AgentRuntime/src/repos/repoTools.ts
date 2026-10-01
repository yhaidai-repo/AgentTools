import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { defineTool } from "../defineTool";
import type { RepoToolOptions } from "../models/RepoToolOptions";
import type { ToolDefinition } from "../models/ToolDefinition";
import { resolveInside } from "../tools/safePath";
import { git, gitOrEmpty } from "./git";

const DEFAULT_READ_LINES = 400;
const DEFAULT_SEARCH_RESULTS = 60;
const MAX_LOG = 30;

// Read-only code tools over the repo cache. Paths start with the repo name: "<repo>/src/file.ts".
export function createRepoTools(options: RepoToolOptions): ToolDefinition<any>[] {
  return [listFilesTool(options), readFileTool(options), searchCodeTool(options), gitLogTool(options)];
}

function listFilesTool(options: RepoToolOptions) {
  return defineTool({
    name: "list_files",
    description: `List a folder in the repos. '' lists the repos: ${options.repos.join(", ")}. Folders end with '/'.`,
    input: { path: z.string().default("").describe("'<repo>/<folder>' or ''") },
    handler: async ({ path }) => {
      if (!path) {
        return { text: options.repos.map((repo) => `${repo}/`).join("\n") };
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
    },
    handler: async ({ path, offset }) => {
      const lines = (await readFile(resolveRepoPath(options, path), "utf8")).split(/\r?\n/);
      const page = lines.slice(offset, offset + maxLines).map((line, index) => `${offset + index + 1}: ${line}`);
      const rest = lines.length - offset - page.length;
      const footer = rest > 0 ? `\n… ${rest} more lines; call again with offset ${offset + page.length}.` : "";

      return { text: page.join("\n") + footer };
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
      repo: z.string().optional().describe("Limit to one repo"),
      glob: z.string().optional().describe("Limit to files matching a pathspec, e.g. '*.cs'"),
    },
    handler: async ({ query, repo, glob }) => {
      const repos = repo ? [allowedRepo(options, repo)] : options.repos;
      const results = await Promise.all(repos.map((name) => grepRepo(options.root, name, query, glob)));
      const lines = results.flat();
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
    },
    handler: async ({ path, limit }) => {
      const [repo, ...rest] = path.split("/");
      const repoRoot = resolveRepoPath(options, allowedRepo(options, repo));
      const output = await git(["log", `-n${limit}`, "--date=short", "--pretty=format:%h %ad %an: %s", "--", rest.join("/") || "."], repoRoot);

      return { text: output || "No commits." };
    },
  });
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

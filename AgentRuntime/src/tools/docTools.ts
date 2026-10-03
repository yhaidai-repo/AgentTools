import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { z } from "zod";
import { defineTool } from "../defineTool";
import type { DocToolOptions } from "../models/DocToolOptions";
import type { ToolDefinition } from "../models/ToolDefinition";
import { DocScope } from "./DocScope";

const DEFAULT_READ_LINES = 400;
const DEFAULT_SEARCH_RESULTS = 50;
const DEFAULT_EXTENSIONS = [".md", ".txt"];

// Read-only access to a docs folder. The same three tools work for every model provider.
export function createDocTools(options: DocToolOptions): ToolDefinition<any>[] {
  const scope = new DocScope(options.root, options.exclude);

  return [listDocsTool(scope), readDocTool(scope, options), searchDocsTool(scope, options)];
}

function listDocsTool(scope: DocScope) {
  return defineTool({
    name: "list_docs",
    description: "List files and folders of the docs vault. Folders end with '/'. Use '' for the top level.",
    input: { dir: z.string().default("").describe("Folder path relative to the docs root") },
    handler: async ({ dir }) => {
      const folder = scope.resolve(dir);
      const entries = await readdir(folder, { withFileTypes: true });
      const visible = entries.filter((entry) => scope.isVisible(join(folder, entry.name)));
      const lines = visible.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name)).sort();

      return { text: lines.join("\n") || "(empty)" };
    },
  });
}

function readDocTool(scope: DocScope, options: DocToolOptions) {
  const maxLines = options.maxReadLines ?? DEFAULT_READ_LINES;

  return defineTool({
    name: "read_doc",
    description: `Read a docs file. Returns up to ${maxLines} lines starting at 'offset' (0-based line number).`,
    input: {
      path: z.string().describe("File path relative to the docs root"),
      offset: z.number().int().min(0).default(0),
    },
    handler: async ({ path, offset }) => {
      const file = scope.resolve(path);
      const lines = (await readFile(file, "utf8")).split(/\r?\n/);
      const page = lines.slice(offset, offset + maxLines);
      const rest = lines.length - offset - page.length;
      const footer = rest > 0 ? `\n… ${rest} more lines; call again with offset ${offset + page.length}.` : "";

      await reportUse(options, [scope.relative(file)], "read");

      return { text: page.join("\n") + footer };
    },
  });
}

function searchDocsTool(scope: DocScope, options: DocToolOptions) {
  const maxResults = options.maxSearchResults ?? DEFAULT_SEARCH_RESULTS;
  const extensions = options.searchExtensions ?? DEFAULT_EXTENSIONS;

  return defineTool({
    name: "search_docs",
    description: `Case-insensitive text search in docs files. Returns up to ${maxResults} 'path:line: text' matches.`,
    input: {
      query: z.string().min(2).describe("Text to find"),
      dir: z.string().default("").describe("Limit the search to this folder"),
    },
    handler: async ({ query, dir }) => {
      const files = await listFiles(scope, scope.resolve(dir), extensions);
      const matches = await findMatches(scope, files, query.toLowerCase(), maxResults);

      await reportUse(options, [...new Set(matches.map((match) => match.slice(0, match.indexOf(":"))))], "search");

      return { text: matches.join("\n") || "No matches." };
    },
  });
}

// Usage tracking must never break the agent's tool call.
async function reportUse(options: DocToolOptions, paths: string[], kind: "read" | "search"): Promise<void> {
  if (!options.onUse || paths.length === 0) {
    return;
  }

  try {
    await options.onUse(paths, kind);
  } catch (error) {
    console.error(`doc usage not recorded (${kind} ${paths.join(", ")}):`, error);
  }
}

async function listFiles(scope: DocScope, folder: string, extensions: string[]): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true, recursive: true });

  return entries
    .filter((entry) => entry.isFile() && extensions.includes(extname(entry.name)))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => scope.isVisible(path));
}

async function findMatches(scope: DocScope, files: string[], query: string, maxResults: number): Promise<string[]> {
  const matches: string[] = [];
  let index = 0;

  while (index < files.length && matches.length < maxResults) {
    const file = files[index];

    matches.push(...matchLines(scope.relative(file), await readFile(file, "utf8"), query));
    index += 1;
  }

  return matches.slice(0, maxResults);
}

function matchLines(path: string, text: string, query: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.toLowerCase().includes(query))
    .map(({ line, number }) => `${path}:${number}: ${line.trim().slice(0, 200)}`);
}

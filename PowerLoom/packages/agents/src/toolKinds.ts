import type { DataAccessKind } from "@powerloom/db";
import type { OutsideResource } from "./models/OutsideResource";

// Optional: how a known tool's call reads in the log (its kind, the resource and the request from its input). A tool
// not listed here is still logged: kind `other`, the tool's name as the resource, its input as the request. New tools
// need no entry; an entry only makes their rows read better.
interface ToolKind {
  kind: DataAccessKind;
  resource?: (input: Record<string, unknown>) => string;
  request?: (input: Record<string, unknown>) => string;
}

const REQUEST_CHARS = 500;

const text = (value: unknown): string => (typeof value === "string" ? value : value === undefined || value === null ? "" : JSON.stringify(value));

const repo: ToolKind = { kind: "repo", resource: (input) => text(input.repo) || "repo", request: (input) => [input.path, input.pattern, input.query].map(text).filter(Boolean).join(" ") };
const docs: ToolKind = { kind: "docs", resource: () => "docs", request: (input) => [input.path, input.query, input.folder].map(text).filter(Boolean).join(" ") };
const internal: ToolKind = { kind: "internal" };

const TOOL_KINDS: Record<string, ToolKind> = {
  list_repos: { kind: "repo", resource: () => "catalog" },
  list_files: repo,
  read_file: repo,
  search_code: repo,
  git_log: repo,
  get_pr_diff: repo,
  read_doc: docs,
  search_docs: docs,
  list_docs: docs,
  WebSearch: { kind: "web", resource: () => "web search", request: (input) => text(input.query) },
  WebFetch: { kind: "web", resource: (input) => hostOf(text(input.url)), request: (input) => text(input.url) },
  use_skill: { kind: "skills", resource: (input) => text(input.name) || "skill" },
  list_skills: { kind: "skills", resource: () => "skills" },
};

// Where and what, for any tool call: the entry's answer, or the defaults.
export function classifyToolCall(name: string, input: unknown): OutsideResource & { request: string } {
  const entry = TOOL_KINDS[name] ?? internalOrOther(name);
  const fields = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const request = entry.request ? entry.request(fields) : JSON.stringify(fields);

  return { kind: entry.kind, resource: entry.resource ? entry.resource(fields) : name, target: name, request: request.slice(0, REQUEST_CHARS) };
}

// PowerLoom's own tools write or read its database (write_*, create_*, record_*, …); anything unknown is `other`.
function internalOrOther(name: string): ToolKind {
  return /^(write_|create_|record_|request_|close_|keep_|fix_|add_|update_|get_pbi|read_attachment|read_note|list_|search_vault|vault_capture)/.test(name) ? internal : { kind: "other" };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url || "web";
  }
}

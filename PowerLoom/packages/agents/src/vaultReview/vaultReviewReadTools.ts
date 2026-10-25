import { textSimilarity } from "@powerloom/core";
import { isLinkEditable, isProtectedNote, type MaintenanceRecord, type ScannedNote, type VaultIndex, type WikiLink } from "@powerloom/vault";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { ReviewScope } from "./ReviewScope";

const PAGE_SIZE = 20;
const READ_LINES = 400;
const SEARCH_RESULTS = 50;
const HEAD_LINES = 6;
const SUGGESTIONS = 3;
// Name overlap below this is noise (two notes of one project share the project word).
const MIN_SUGGESTION_SIMILARITY = 0.3;

const vaultInput = z.string().min(1).describe("Vault folder name, one of the run's vaults (e.g. work-projects)");
const pathInput = z.string().min(1).describe("Note path relative to the vault root, e.g. shop/orders/rule.md");
const pageInput = {
  offset: z.number().int().min(0).default(0).describe("Skip this many entries"),
  limit: z.number().int().min(1).max(50).default(PAGE_SIZE),
};

type ToolText = { text: string; isError?: boolean };

// The vault review's read tools (user decision 2026-10-03: tools pull the candidates, the agent decides). They read the
// run's scan, never log usage (a review read is no use), and leave out protected notes and recently decided ones.
export function createVaultReviewReadTools(scope: ReviewScope): ToolDefinition<any>[] {
  return [
    listStaleNotesTool(scope),
    listUnlinkedNotesTool(scope),
    listInvalidLinksTool(scope),
    listOpenRecordsTool(scope),
    listLinksTool(scope),
    listBacklinksTool(scope),
    listNotesTool(scope),
    readNoteTool(scope),
    searchVaultTool(scope),
  ];
}

function listStaleNotesTool(scope: ReviewScope) {
  return defineTool({
    name: "list_stale_notes",
    description: `Notes nobody read or searched for ${scope.options.staleDays} days (Claude Code and PowerLoom's agents): last use, inbound links, last change.`,
    input: { vault: vaultInput, ...pageInput },
    handler: async (input) => inVault(scope, input.vault, async (index) => {
      const notes = (await scope.candidates(input.vault)).stale;

      return pageOf(notes, input.offset, input.limit, (note) => noteLine(index, note), "No stale notes.");
    }),
  });
}

function listUnlinkedNotesTool(scope: ReviewScope) {
  return defineTool({
    name: "list_unlinked_notes",
    description: "Notes no other note links to (body or `related` frontmatter): last use, last change.",
    input: { vault: vaultInput, ...pageInput },
    handler: async (input) => inVault(scope, input.vault, async (index) => {
      const notes = (await scope.candidates(input.vault)).unlinked;

      return pageOf(notes, input.offset, input.limit, (note) => noteLine(index, note), "No unlinked notes.");
    }),
  });
}

function listInvalidLinksTool(scope: ReviewScope) {
  return defineTool({
    name: "list_invalid_links",
    description: "Dead links: links whose target is no file of the vault, with the line around each and notes with a similar name. Fix each with fix_link.",
    input: { vault: vaultInput, ...pageInput },
    handler: async (input) => inVault(scope, input.vault, async (index) => {
      const links = (await scope.candidates(input.vault)).deadLinks;

      return pageOf(links, input.offset, input.limit, (link) => deadLinkLine(index, link), "No dead links.");
    }),
  });
}

function listOpenRecordsTool(scope: ReviewScope) {
  return defineTool({
    name: "list_open_records",
    description: "Open records of the vault's registers (www-log.md, <key>-known-issues, <key>-open-questions): register, id, status, last update, title. Records kept recently are left out. Check each with close_record or keep_record.",
    input: { vault: vaultInput, ...pageInput },
    handler: async (input) => inVault(scope, input.vault, async () => {
      const records = (await scope.candidates(input.vault)).records;

      return pageOf(records, input.offset, input.limit, recordLine, "No open records.");
    }),
  });
}

function listLinksTool(scope: ReviewScope) {
  return defineTool({
    name: "list_links",
    description: "A note's outgoing links: the line around each, and the target's title and first lines, to check that each link still means what its line says.",
    input: { vault: vaultInput, path: pathInput },
    handler: async (input) => inNote(scope, input.vault, input.path, async (index) => {
      const lines = index.linksFrom(input.path).map((link) => outgoingLinkLine(index, link));

      return { text: lines.join("\n") || "The note has no links." };
    }),
  });
}

function listBacklinksTool(scope: ReviewScope) {
  return defineTool({
    name: "list_backlinks",
    description: "The notes that link to a note, with the line around each link. A note you remove must have no links left: repoint or drop each with fix_link.",
    input: { vault: vaultInput, path: pathInput },
    handler: async (input) => inNote(scope, input.vault, input.path, async (index) => {
      const lines = index.linksTo(input.path).map((link) => `${link.from}:${link.line}${isLinkEditable(link.from) ? "" : " (not editable)"}: ${link.text}`);

      return { text: lines.join("\n") || "No note links to it." };
    }),
  });
}

function listNotesTool(scope: ReviewScope) {
  return defineTool({
    name: "list_notes",
    description: "The vault's notes (path and title) under a folder, e.g. to find the right target for a link. Protected notes are marked; they are never removed.",
    input: { vault: vaultInput, folder: z.string().default("").describe("Folder relative to the vault root; '' for all") },
    handler: async (input) => inVault(scope, input.vault, async (index) => {
      const notes = index.notes.filter((note) => note.path.startsWith(input.folder));
      const lines = notes.map((note) => `${note.path} · "${note.title}"${isProtectedNote(note.path) ? " · protected" : ""}`);

      return { text: lines.join("\n") || "No notes there." };
    }),
  });
}

function readNoteTool(scope: ReviewScope) {
  return defineTool({
    name: "read_note",
    description: `Read a note of a vault. Returns up to ${READ_LINES} lines from 'offset' (0-based line number).`,
    input: { vault: vaultInput, path: pathInput, offset: z.number().int().min(0).default(0) },
    handler: async (input) => inNote(scope, input.vault, input.path, async (index) => {
      const lines = index.note(input.path)!.content.split(/\r?\n/);
      const page = lines.slice(input.offset, input.offset + READ_LINES);
      const rest = lines.length - input.offset - page.length;

      return { text: page.join("\n") + (rest > 0 ? `\n… ${rest} more lines; call again with offset ${input.offset + page.length}.` : "") };
    }),
  });
}

function searchVaultTool(scope: ReviewScope) {
  return defineTool({
    name: "search_vault",
    description: `Case-insensitive text search in a vault's notes. Returns up to ${SEARCH_RESULTS} 'path:line: text' matches.`,
    input: { vault: vaultInput, query: z.string().min(2) },
    handler: async (input) => inVault(scope, input.vault, async (index) => {
      const query = input.query.toLowerCase();
      const matches = index.notes.flatMap((note) => matchingLines(note, query)).slice(0, SEARCH_RESULTS);

      return { text: matches.join("\n") || "No matches." };
    }),
  });
}

async function inVault(scope: ReviewScope, vault: string, work: (index: VaultIndex) => Promise<ToolText>): Promise<ToolText> {
  if (!scope.hasVault(vault)) {
    return { text: `Unknown vault "${vault}"; this run reviews: ${scope.vaults.join(", ")}.`, isError: true };
  }

  return work(await scope.index(vault));
}

async function inNote(scope: ReviewScope, vault: string, path: string, work: (index: VaultIndex) => Promise<ToolText>): Promise<ToolText> {
  return inVault(scope, vault, async (index) => (index.note(path) ? work(index) : { text: `No note "${path}" in ${vault}; list_notes shows the paths.`, isError: true }));
}

function pageOf<T>(items: T[], offset: number, limit: number, render: (item: T) => string, empty: string): ToolText {
  const page = items.slice(offset, offset + limit);
  const rest = items.length - offset - page.length;

  if (page.length === 0) {
    return { text: offset === 0 ? empty : "No more entries." };
  }

  return { text: page.map(render).join("\n") + (rest > 0 ? `\n… ${rest} more; call again with offset ${offset + page.length}.` : "") };
}

function noteLine(index: VaultIndex, note: ScannedNote): string {
  return `${note.path} · "${note.title}" · last used ${day(index.lastUse(note.path))} · ${index.linksTo(note.path).length} inbound link(s) · changed ${day(note.mtime)}`;
}

function recordLine(record: MaintenanceRecord): string {
  return `${record.path} · ${record.id} · ${record.status || "no status"} · updated ${record.updated ?? "?"} · "${record.title}"`;
}

function deadLinkLine(index: VaultIndex, link: WikiLink): string {
  const similar = similarNotes(index, link.target);

  return `${link.from}:${link.line}: [[${link.target}]] · line: ${link.text}${similar.length > 0 ? ` · similar: ${similar.join(", ")}` : ""}`;
}

function outgoingLinkLine(index: VaultIndex, link: WikiLink): string {
  const resolved = index.resolve(link.target);
  const target = resolved ? index.note(resolved) : undefined;
  const head = target ? `\n    target "${target.title}": ${bodyHead(target)}` : "";

  return `line ${link.line}: [[${link.target}${link.heading ? `#${link.heading}` : ""}]] → ${resolved ?? "DEAD (no such file)"} · line: ${link.text}${head}`;
}

function similarNotes(index: VaultIndex, target: string): string[] {
  const scored = index.notes.map((note) => ({ name: note.name, score: textSimilarity(note.name, target) }));

  return scored.filter((entry) => entry.score >= MIN_SUGGESTION_SIMILARITY).sort((a, b) => b.score - a.score).slice(0, SUGGESTIONS).map((entry) => entry.name);
}

// The first lines after the frontmatter: enough to tell what the target is about.
function bodyHead(note: ScannedNote): string {
  const body = note.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  return lines.slice(0, HEAD_LINES).join(" / ").slice(0, 400);
}

function matchingLines(note: ScannedNote, query: string): string[] {
  return note.content
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.toLowerCase().includes(query))
    .map(({ line, number }) => `${note.path}:${number}: ${line.trim().slice(0, 200)}`);
}

function day(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "never";
}

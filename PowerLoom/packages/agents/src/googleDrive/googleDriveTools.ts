import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import { defineOutsideTool } from "../outsideAccess";
import { DriveRequestError } from "./DriveRequestError";
import { DriveScope } from "./DriveScope";
import { driveFileText } from "./driveFileText";
import type { DriveFile } from "./models/DriveFile";
import type { GoogleDriveAccess } from "./models/GoogleDriveAccess";

export const GOOGLE_DRIVE_INTEGRATION = "readGoogleDrive";

const MAX_RESULTS = 30;
const MAX_CHARS = 60_000;
// Folders per Drive query: the query string stays short.
const PARENT_CHUNK = 40;

// The Google Drive tools (user decision 2026-10-25), for an agent with the integration switched on in its Config while
// its vault's Drive is on, signed in, with chosen folders: search and read inside those folders only, read-only by the
// sign-in's scope. Every call goes to the data access log; a refused sign-in asks the user to sign in again.
export function createGoogleDriveTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext): ToolDefinition<any>[] {
  const isOn = agent.capabilities.integrations?.[GOOGLE_DRIVE_INTEGRATION] === true;

  if (!isOn || !deps.googleDrive || deps.googleDrive.folders.length === 0) {
    return [];
  }

  const scope = new DriveScope(deps.googleDrive.reader, deps.googleDrive.folders);

  return [searchTool(deps, deps.googleDrive, context, scope), readTool(deps, deps.googleDrive, context, scope)];
}

function searchTool(deps: AgentDeps, drive: GoogleDriveAccess, context: OutsideAccessContext, scope: DriveScope) {
  const names = drive.folders.map((folder) => folder.name) as [string, ...string[]];

  return defineOutsideTool(deps.outside, context, {
    name: "drive_search",
    description: `Search Google Drive for files whose name or text has the words, in the folders this vault shares with agents (${names.join(", ")}) and below them. Newest first, at most ${MAX_RESULTS}; read one with drive_read.`,
    input: {
      text: z.string().trim().min(2).describe("Words the file's name or text has, e.g. payer mapping"),
      folder: z.enum(names).optional().describe("Only this shared folder; leave out to search them all"),
    },
    resource: (input) => ({ kind: "googleDrive", resource: input.folder ?? "Google Drive", target: input.text }),
    request: (input) => `search ${input.text}`,
    handler: (input) => guarded(async () => searchResult(await searchIn(drive, scope, input.folder, input.text))),
  });
}

function readTool(deps: AgentDeps, drive: GoogleDriveAccess, context: OutsideAccessContext, scope: DriveScope) {
  return defineOutsideTool(deps.outside, context, {
    name: "drive_read",
    description: `Read a Google Drive file's text by its id (from drive_search) or link: Docs and Slides as text, Sheets as CSV, PDFs and Office files as text. Only files in the folders this vault shares with agents; at most ${MAX_CHARS} characters.`,
    input: { file: z.string().trim().min(1).describe("The file's id or its Drive link") },
    resource: (input) => ({ kind: "googleDrive", resource: "Google Drive", target: fileIdOf(input.file) }),
    request: (input) => `read ${fileIdOf(input.file)}`,
    handler: (input) => guarded(() => readIn(drive, scope, fileIdOf(input.file))),
  });
}

async function searchIn(drive: GoogleDriveAccess, scope: DriveScope, folder: string | undefined, text: string): Promise<DriveFile[]> {
  const roots = drive.folders.filter((root) => !folder || root.name === folder);
  const parents = (await Promise.all(roots.map((root) => scope.foldersBelow(root)))).flat();
  const found: DriveFile[] = [];

  for (let start = 0; start < parents.length && found.length < MAX_RESULTS; start += PARENT_CHUNK) {
    found.push(...(await drive.reader.search(parents.slice(start, start + PARENT_CHUNK), text, MAX_RESULTS - found.length)));
  }

  return found;
}

async function readIn(drive: GoogleDriveAccess, scope: DriveScope, id: string): Promise<OutsideToolResult> {
  const file = await drive.reader.get(id);
  const root = await scope.rootOf(file);

  if (!root) {
    const refusal = `${file.name} isn't in a folder this vault shares with agents (${drive.folders.map((folder) => folder.name).join(", ")}).`;

    return { text: refusal, isError: true, refusal };
  }

  const read = await driveFileText(drive.reader, file);

  if (!read.ok) {
    return { text: read.error, isError: true };
  }

  const truncated = read.text.length > MAX_CHARS;
  const header = `${file.name} (in ${root.name}, modified ${file.modifiedTime?.slice(0, 10) ?? "–"})${file.webViewLink ? ` ${file.webViewLink}` : ""}`;

  return { text: `${header}\n\n${read.text.slice(0, MAX_CHARS)}${truncated ? "\n\n[cut: the file is longer]" : ""}`, truncated };
}

function searchResult(files: DriveFile[]): OutsideToolResult {
  if (files.length === 0) {
    return { text: "Nothing found in the shared folders.", rows: 0 };
  }

  const lines = files.map((file) => `- ${file.name} · id ${file.id} · ${file.mimeType.replace("application/vnd.google-apps.", "google ")} · modified ${file.modifiedTime?.slice(0, 10) ?? "–"}`);

  return { text: lines.join("\n"), rows: files.length };
}

// Drive's refusals are answers: a refused sign-in or a file the account can't see is `denied` (the user is asked to fix
// it), anything else a failed call.
async function guarded(call: () => Promise<OutsideToolResult>): Promise<OutsideToolResult> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof DriveRequestError) {
      return { text: error.message, isError: true, denied: error.isDenied };
    }

    throw error;
  }
}

// A Drive link (…/d/<id>/…, …/folders/<id>, …?id=<id>) or a bare id.
export function fileIdOf(file: string): string {
  const fromPath = /\/(?:d|folders)\/([\w-]+)/.exec(file);
  const fromQuery = /[?&]id=([\w-]+)/.exec(file);

  return fromPath?.[1] ?? fromQuery?.[1] ?? file.trim();
}

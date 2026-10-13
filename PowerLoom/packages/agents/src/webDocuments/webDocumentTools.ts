import { storeAttachment } from "@powerloom/attachments";
import { attachmentRef, createHumanTask, documentKey, documentUrl, itemStatusWithKey } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { WebDocumentRun } from "./models/WebDocumentRun";

const MAX_NOTES_CHARS = 20_000;
const MAX_REASON_CHARS = 500;

// The tools of an agent with web access for the PBI's unread web pages (user decision 2026-10-14). Both write at once,
// not on the run's success: notes are what the page says, and the user's task must exist even when the run fails later.
export function createWebDocumentTools(db: PowerLoomDb, run: WebDocumentRun | null): ToolDefinition<any>[] {
  if (!run || run.urls.length === 0) {
    return [];
  }

  return [saveNotesTool(db, run), requestDocumentTool(db, run)];
}

function saveNotesTool(db: PowerLoomDb, run: WebDocumentRun): ToolDefinition<any> {
  const saved = new Map<string, string>();

  return defineTool({
    name: "save_document_notes",
    description: "Save what a web page from <web-documents> says that matters for this PBI, in Markdown, as the page's content for every agent. Once per page.",
    input: {
      url: z.string().describe("The page, as listed in <web-documents>"),
      notes: z.string().min(1).max(MAX_NOTES_CHARS).describe("Facts, rules and numbers that matter for the PBI, each with the section it comes from; or why nothing does"),
    },
    handler: async (input) => {
      const url = documentUrl(input.url);
      const problem = unknownPage(run, url) ?? (saved.has(url) ? `Already saved as ${saved.get(url)}.` : null);

      if (problem) {
        return { text: problem, isError: true };
      }

      const stored = await storeAttachment(db, notesFile(run, url, input.notes), { adoId: run.adoId, itemId: null, sourceUrl: url, origin: "agent" });

      if (!stored.ok) {
        return { text: stored.error, isError: true };
      }

      saved.set(url, attachmentRef(stored.value));

      return { text: `Saved as ${saved.get(url)}.` };
    },
  });
}

function requestDocumentTool(db: PowerLoomDb, run: WebDocumentRun): ToolDefinition<any> {
  return defineTool({
    name: "request_document",
    description: "Ask the user to attach a web page from <web-documents> you couldn't open. Only after trying it with your web tools.",
    input: {
      url: z.string().describe("The page, as listed in <web-documents>"),
      why: z.string().min(1).max(MAX_REASON_CHARS).describe("What happened when you opened it, e.g. 403, a login page, not found"),
    },
    handler: async (input) => {
      const url = documentUrl(input.url);
      const problem = unknownPage(run, url);

      if (problem) {
        return { text: problem, isError: true };
      }

      const existing = await itemStatusWithKey(db, run.adoId, documentKey(url));

      if (existing !== null) {
        return { text: `The user was already asked for it (task ${existing}).` };
      }

      const id = await createHumanTask(db, { adoId: run.adoId, title: "Attach the content of the linked document", body: requestBody(run, url, input.why), runId: run.runId, data: { url, key: documentKey(url) } });

      return { text: `Asked the user: ${id}.` };
    },
  });
}

function unknownPage(run: WebDocumentRun, url: string): string | null {
  return run.urls.includes(url) ? null : `${url} isn't one of the pages in <web-documents>.`;
}

function notesFile(run: WebDocumentRun, url: string, notes: string) {
  const text = [`# Notes on ${url}`, "", `Saved by ${run.agentId} for ${run.taskId} (RUN-${run.runId}): what the page says for this PBI, not the page itself.`, "", notes.trim(), ""].join("\n");

  return { fileName: `notes-${slugOf(url)}.md`, contentType: "text/markdown", bytes: Buffer.from(text, "utf8") };
}

// Like PowerLoom's DocumentTasks body, with what the agent met instead of "agents can't open it".
function requestBody(run: WebDocumentRun, url: string, why: string): string {
  return `The PBI links ${url}\n\n${run.agentId} couldn't open it: ${why.trim()}\n\nUpload it here (PDF, Word, saved HTML or text). Cancel the task if the agents don't need it.`;
}

function slugOf(url: string): string {
  if (!URL.canParse(url)) {
    return "page";
  }

  const { hostname, pathname } = new URL(url);
  const name = pathname.split("/").filter(Boolean).pop() ?? hostname;

  return name.replace(/\.[a-z0-9]+$/i, "").replace(/[^\w-]+/g, "-").slice(0, 60) || hostname;
}

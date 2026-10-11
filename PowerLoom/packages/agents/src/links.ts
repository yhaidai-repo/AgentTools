import { linkedDocumentKind, pbiLinkedUrls } from "@powerloom/core";
import type { workItem } from "@powerloom/db";
import type { AttachmentSummary } from "./models/AttachmentSummary";
import type { LinkedDocument } from "./models/LinkedDocument";

type WorkItemRow = typeof workItem.$inferSelect;

// Every link in the PBI's description and acceptance criteria. Agents can't open any of them; the worker downloads
// ADO attachments and asks the user (a blocking human task) for the rest, so by the time an agent runs each has content
// or the user decided it isn't needed.
export function linkedDocuments(row: WorkItemRow): LinkedDocument[] {
  return pbiLinkedUrls(row).map((url) => ({ url, kind: linkedDocumentKind(url) }));
}

export function linksBlock(links: LinkedDocument[], attachments: AttachmentSummary[]): string {
  if (links.length === 0) {
    return "<linked-documents>none</linked-documents>";
  }

  const lines = links.map((link) => `- ${link.url} (${link.kind}): ${linkContent(link, attachments)}`);

  return ["<linked-documents>", "Linked from the PBI. You cannot open these links; read the content with read_attachment where one is given.", ...lines, "</linked-documents>"].join("\n");
}

function linkContent(link: LinkedDocument, attachments: AttachmentSummary[]): string {
  const ids = attachments.filter((attachment) => attachment.sourceUrl === link.url).map((attachment) => attachment.id);

  return ids.length > 0 ? `content provided as ${ids.join(", ")}` : "no content: the user decided agents don't need it";
}

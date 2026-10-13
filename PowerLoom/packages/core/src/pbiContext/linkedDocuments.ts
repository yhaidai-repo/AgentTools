import { documentUrl, linkedDocumentKind, pbiLinkedUrls } from "../urls";
import type { workItem } from "@powerloom/db";
import type { AttachmentSummary } from "../models/AttachmentSummary";
import type { LinkedDocument } from "../models/LinkedDocument";

type WorkItemRow = typeof workItem.$inferSelect;

// Every link in the PBI's description and acceptance criteria. PowerLoom downloads ADO attachments and Confluence pages;
// a web page is read by agents with web access, who save their notes on it (user decision 2026-10-14), and the user is
// asked for it when an agent without web access needs it.
export function linkedDocuments(row: WorkItemRow): LinkedDocument[] {
  return pbiLinkedUrls(row).map((url) => ({ url, kind: linkedDocumentKind(url) }));
}

export function linksBlock(links: LinkedDocument[], attachments: AttachmentSummary[]): string {
  if (links.length === 0) {
    return "<linked-documents>none</linked-documents>";
  }

  const lines = links.map((link) => `- ${link.url} (${link.kind}): ${linkContent(link, attachments)}`);

  return ["<linked-documents>", "Linked from the PBI. Read the content with read_attachment where one is given.", ...lines, "</linked-documents>"].join("\n");
}

function linkContent(link: LinkedDocument, attachments: AttachmentSummary[]): string {
  const ids = attachments.filter((attachment) => attachment.sourceUrl !== null && documentUrl(attachment.sourceUrl) === link.url).map((attachment) => attachment.id);

  if (ids.length > 0) {
    return `content provided as ${ids.join(", ")}`;
  }

  return link.kind === "web" ? "no content yet: a web page, read by agents with web access" : "no content: the user decided agents don't need it";
}

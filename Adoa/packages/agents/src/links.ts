import { pbiLinkedUrls } from "@adoa/core";
import type { workItem } from "@adoa/db";
import type { AttachmentSummary } from "./models/AttachmentSummary";
import type { LinkedDocument } from "./models/LinkedDocument";

type WorkItemRow = typeof workItem.$inferSelect;

// Every link in the PBI's description and acceptance criteria. Agents can't open any of them
// (no web access, and Confluence/ADO need a login), so each is missing input unless the user uploaded its content.
export function linkedDocuments(row: WorkItemRow): LinkedDocument[] {
  return pbiLinkedUrls(row).map((url) => ({ url, kind: kindOf(url) }));
}

export function linksBlock(links: LinkedDocument[], attachments: AttachmentSummary[]): string {
  if (links.length === 0) {
    return "<linked-documents>none</linked-documents>";
  }

  const lines = links.map((link) => `- ${link.url} (${link.kind}): ${linkContent(link, attachments)}`);

  return ["<linked-documents>", "Linked from the PBI. You cannot open these links; read the user's upload with read_attachment where one is given.", ...lines, "</linked-documents>"].join("\n");
}

// URLs whose content the user uploaded; refinement asks no question for them.
export function providedUrls(attachments: AttachmentSummary[]): string[] {
  return attachments.flatMap((attachment) => (attachment.sourceUrl ? [attachment.sourceUrl] : []));
}

function linkContent(link: LinkedDocument, attachments: AttachmentSummary[]): string {
  const ids = attachments.filter((attachment) => attachment.sourceUrl === link.url).map((attachment) => attachment.id);

  return ids.length > 0 ? `content provided as ${ids.join(", ")}` : "content missing";
}

function kindOf(url: string): LinkedDocument["kind"] {
  if (/atlassian\.net\/wiki/i.test(url)) {
    return "confluence";
  }

  return /_apis\/wit\/attachments/i.test(url) ? "ado-attachment" : "web";
}

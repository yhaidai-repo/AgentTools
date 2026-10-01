import type { workItem } from "@adoa/db";
import type { LinkedDocument } from "./models/LinkedDocument";

type WorkItemRow = typeof workItem.$inferSelect;

const URL_PATTERN = /https?:\/\/[^\s)\]>"'`]+/g;

// Every link in the PBI's description and acceptance criteria. Agents can't open any of them
// (no web access, and Confluence/ADO need a login), so each is listed as a missing input.
export function linkedDocuments(row: WorkItemRow): LinkedDocument[] {
  const text = `${row.descriptionMd ?? ""}\n${row.acceptanceCriteriaMd ?? ""}`;
  const urls = [...new Set(text.match(URL_PATTERN) ?? [])].map(trimTrailingPunctuation);

  return [...new Set(urls)].map((url) => ({ url, kind: kindOf(url) }));
}

export function linksBlock(links: LinkedDocument[]): string {
  if (links.length === 0) {
    return "<linked-documents>none</linked-documents>";
  }

  const lines = links.map((link) => `- ${link.url} (${link.kind})`);

  return ["<linked-documents>", "Linked from the PBI. You cannot open these; treat their content as missing input.", ...lines, "</linked-documents>"].join("\n");
}

function kindOf(url: string): LinkedDocument["kind"] {
  if (/atlassian\.net\/wiki/i.test(url)) {
    return "confluence";
  }

  return /_apis\/wit\/attachments/i.test(url) ? "ado-attachment" : "web";
}

function trimTrailingPunctuation(url: string): string {
  return url.replace(/[.,;:!?]+$/, "");
}

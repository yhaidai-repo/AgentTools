import type { LinkedDocumentKind } from "./models/LinkedDocumentKind";

const URL_PATTERN = /https?:\/\/[^\s)\]>"'`]+/g;

// Every distinct URL in a text, without trailing sentence punctuation.
export function extractUrls(text: string): string[] {
  const urls = (text.match(URL_PATTERN) ?? []).map((url) => url.replace(/[.,;:!?]+$/, ""));

  return [...new Set(urls)];
}

// The documents a PBI links from its description and acceptance criteria, each once.
export function pbiLinkedUrls(pbi: { descriptionMd: string | null; acceptanceCriteriaMd: string | null }): string[] {
  const urls = extractUrls(`${pbi.descriptionMd ?? ""}\n${pbi.acceptanceCriteriaMd ?? ""}`).map(documentUrl);

  return [...new Set(urls)];
}

// A web page's `#…` anchor is a place in the same document (user decision 2026-10-14), so it is dropped; Confluence
// pages keep theirs, as their stored pages are matched by the link as written. PowerLoom's LinkedDocuments.DocumentUrl.
export function documentUrl(url: string): string {
  return linkedDocumentKind(url) === "web" ? url.split("#")[0] : url;
}

export function linkedDocumentKind(url: string): LinkedDocumentKind {
  if (/atlassian\.net\/wiki/i.test(url)) {
    return "confluence";
  }

  return /_apis\/wit\/attachments/i.test(url) ? "ado-attachment" : "web";
}

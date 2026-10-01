const URL_PATTERN = /https?:\/\/[^\s)\]>"'`]+/g;

// Every distinct URL in a text, without trailing sentence punctuation.
export function extractUrls(text: string): string[] {
  const urls = (text.match(URL_PATTERN) ?? []).map((url) => url.replace(/[.,;:!?]+$/, ""));

  return [...new Set(urls)];
}

// The documents a PBI links from its description and acceptance criteria.
export function pbiLinkedUrls(pbi: { descriptionMd: string | null; acceptanceCriteriaMd: string | null }): string[] {
  return extractUrls(`${pbi.descriptionMd ?? ""}\n${pbi.acceptanceCriteriaMd ?? ""}`);
}

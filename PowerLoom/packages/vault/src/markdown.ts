import TurndownService from "turndown";

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });

const HTML_TAG = /<\/?[a-z][a-z0-9]*[\s>/]/i;

// ADO multiline fields can be HTML or, in markdown mode, already markdown; converting markdown would escape it.
export function htmlToMarkdown(value: string): string {
  const text = value ?? "";

  return HTML_TAG.test(text) ? turndown.turndown(text).trim() : text.trim();
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll(/\r?\n/g, " ");
}

// Generated regions are rewritten on every render; everything else except `## Notes` is too.
export function region(name: string, body: string): string {
  return `<!-- adoa:begin ${name} -->\n${body}\n<!-- adoa:end ${name} -->`;
}

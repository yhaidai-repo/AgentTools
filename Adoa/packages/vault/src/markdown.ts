import TurndownService from "turndown";

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });

export function htmlToMarkdown(html: string): string {
  const markdown = turndown.turndown(html ?? "").trim();

  return markdown || "_Empty in Azure DevOps._";
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

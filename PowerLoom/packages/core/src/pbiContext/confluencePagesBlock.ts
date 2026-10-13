import type { PbiConfluencePage } from "@powerloom/db";

const ADDED_BY: Record<PbiConfluencePage["by"], string> = { user: "the user", refinement: "refinement", research: "research", design: "design" };

// For the first message: the PBI's useful Confluence pages, read with read_confluence_page by agents that have it.
export function confluencePagesBlock(pages: PbiConfluencePage[]): string {
  if (pages.length === 0) {
    return "<confluence-pages>none</confluence-pages>";
  }

  const lines = pages.map((page) => `- ${page.title}: ${page.url} – ${page.why || "no reason given"} (added by ${ADDED_BY[page.by]})`);

  return ["<confluence-pages>", "Useful Confluence pages for this PBI; open them with read_confluence_page if you have it.", ...lines, "</confluence-pages>"].join("\n");
}

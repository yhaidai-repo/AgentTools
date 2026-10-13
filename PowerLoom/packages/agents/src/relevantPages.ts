import { addPbiConfluencePages, confluencePageProblem, pageTitleFromUrl } from "@powerloom/core";
import type { PowerLoomDb, PbiConfluencePage } from "@powerloom/db";
import { z } from "zod";
import type { RelevantPage } from "./models/RelevantPage";

// The output field refinement and research share (user decision 2026-10-02): useful Confluence pages, like relevant docs.
export const relevantPagesInput = z
  .array(z.object({ url: z.string(), why: z.string() }))
  .default([])
  .describe("Confluence pages (their links) the later agents should read, and why; none is fine");

export function relevantPageProblems(pages: RelevantPage[]): string[] {
  return pages.map((page) => confluencePageProblem(page.url)).filter((problem): problem is string => problem !== null);
}

// Added to the PBI's page list when the run succeeds; pages already listed keep their entry.
export async function commitRelevantPages(db: PowerLoomDb, adoId: number, pages: RelevantPage[], by: PbiConfluencePage["by"]): Promise<void> {
  await addPbiConfluencePages(db, adoId, pages.map((page) => ({ url: page.url, title: pageTitleFromUrl(page.url), why: page.why, by })));
}

// The pages an agent read in its run join the ones it listed (user decision 2026-10-02: refinement keeps what it used);
// a listed page keeps the agent's reason.
export function withPagesRead(listed: RelevantPage[], readUrls: string[], why: string): RelevantPage[] {
  const unlisted = readUrls.filter((url) => !listed.some((page) => page.url === url));

  return [...listed, ...unlisted.map((url) => ({ url, why }))];
}

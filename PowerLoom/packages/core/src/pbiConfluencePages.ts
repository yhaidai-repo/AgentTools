import { confluencePageId } from "@powerloom/confluence";
import { workItem, type PowerLoomDb, type PbiConfluencePage } from "@powerloom/db";
import { eq } from "drizzle-orm";
import { linkedDocumentKind } from "./urls";

// A link PowerLoom can list as a Confluence page: a Confluence Cloud link with a page id.
export function confluencePageProblem(url: string): string | null {
  const isConfluence = URL.canParse(url) && linkedDocumentKind(url) === "confluence";

  return isConfluence && confluencePageId(url) ? null : `not a Confluence page link (…/wiki/spaces/<space>/pages/<id>/…): ${url}`;
}

// The title in a page link (`…/pages/<id>/Patient+Signal+-+X`), for pages added without one.
export function pageTitleFromUrl(url: string): string {
  const slug = new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "";

  return /^\d+$/.test(slug) ? "Confluence page" : safeDecode(slug.replaceAll("+", " "));
}

// A malformed %-escape in a pasted link shouldn't fail the save; the raw text is a good enough title then.
function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

// An agent's useful pages join the PBI's list; pages already on it keep their entry (the user's wording wins).
export async function addPbiConfluencePages(db: PowerLoomDb, adoId: number, pages: PbiConfluencePage[]): Promise<void> {
  if (pages.length === 0) {
    return;
  }

  const [row] = await db.select({ pages: workItem.confluencePages }).from(workItem).where(eq(workItem.adoId, adoId));
  const listed = new Set((row?.pages ?? []).map((page) => page.url));
  const added = pages.filter((page, index) => !listed.has(page.url) && pages.findIndex((other) => other.url === page.url) === index);

  if (added.length > 0) {
    await db.update(workItem).set({ confluencePages: [...(row?.pages ?? []), ...added] }).where(eq(workItem.adoId, adoId));
  }
}

// The user removes a page from the PBI's list (agent-added ones too).
export async function removePbiConfluencePage(db: PowerLoomDb, adoId: number, url: string): Promise<void> {
  const [row] = await db.select({ pages: workItem.confluencePages }).from(workItem).where(eq(workItem.adoId, adoId));

  await db.update(workItem).set({ confluencePages: (row?.pages ?? []).filter((page) => page.url !== url) }).where(eq(workItem.adoId, adoId));
}

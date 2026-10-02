import { MAX_ATTACHMENT_BYTES, READABLE_EXTENSIONS, storeAttachment } from "@adoa/attachments";
import { ConfluenceClient, type ConfluenceFile, type ConfluencePage } from "@adoa/confluence";
import { createDocumentTask, linkedDocumentKind, pbiLinkedUrls, resolveDocumentTask } from "@adoa/core";
import { attachment, workItem, type AdoaDb } from "@adoa/db";
import { VaultWriter } from "@adoa/vault";
import { and, eq, inArray } from "drizzle-orm";
import { extname } from "node:path";
import type { WorkerContext } from "../models/WorkerContext";

type AttachmentRow = typeof attachment.$inferSelect;

const NOT_SET_UP = "Confluence isn't set up: CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN in .env (worker)";

// The Confluence pages a PBI links (user decision 2026-10-02): fetched with their readable files and stored as the PBI's
// attachments for that link. "missing" fetches only links without a fetched copy (first fetch or a retry); "all" also
// checks the version of the copies and replaces them when the page changed. No job and no timer: callers are Prepare
// and the dispatcher about to start a task on the PBI.
export async function syncConfluencePages(context: WorkerContext, adoId: number, which: "missing" | "all"): Promise<void> {
  const [row] = await context.db.select().from(workItem).where(eq(workItem.adoId, adoId));
  const links = row ? pbiLinkedUrls(row).filter((url) => linkedDocumentKind(url) === "confluence") : [];

  for (const url of links) {
    const copies = await fetchedCopies(context.db, adoId, url);

    if (which === "all" || copies.length === 0) {
      await syncPage(context, adoId, url, copies);
    }
  }
}

// The user's "Load from Confluence" for one linked page: fetched (or brought to its current version) now.
export async function loadLinkedPage(context: WorkerContext, adoId: number, url: string): Promise<void> {
  await syncPage(context, adoId, url, await fetchedCopies(context.db, adoId, url));
}

// One linked page brought up to date. Without a usable copy, a failure becomes the user's task with the reason; with
// one, the copy stays and the failure is logged (the agents keep reading the last fetched version).
export async function syncPage(context: WorkerContext, adoId: number, url: string, copies: AttachmentRow[]): Promise<void> {
  const client = ConfluenceClient.fromEnv();

  try {
    await fetchPage(context, client, adoId, url, copies);
  } catch (error) {
    await reportFailure(context.db, adoId, url, copies, (error as Error).message);
  }
}

async function fetchPage(context: WorkerContext, client: ConfluenceClient | null, adoId: number, url: string, copies: AttachmentRow[]): Promise<void> {
  if (!client) {
    throw new Error(NOT_SET_UP);
  }

  const page = await client.page(url);

  if (!copies.some((copy) => copy.sourceVersion === page.version)) {
    await storePage(context.db, client, adoId, url, page);
    await removeCopies(context, copies);
  }

  await resolveDocumentTask(context.db, adoId, url, `Fetched from Confluence (v${page.version}).`);
}

// The page first, then its readable files; a file that can't be stored is logged and skipped, the page still counts.
async function storePage(db: AdoaDb, client: ConfluenceClient, adoId: number, url: string, page: ConfluencePage): Promise<void> {
  const target = { adoId, itemId: null, sourceUrl: url, origin: "confluence" as const, sourceVersion: page.version };
  const stored = await storeAttachment(db, { fileName: `${fileSafe(page.title)}.html`, contentType: "text/html", bytes: Buffer.from(page.html, "utf8") }, target);

  if (!stored.ok) {
    throw new Error(`the page couldn't be stored: ${stored.error}`);
  }

  const files = (await client.files(url)).filter(isReadable);

  for (const file of files) {
    await storeFile(db, client, file, target);
  }
}

async function storeFile(db: AdoaDb, client: ConfluenceClient, file: ConfluenceFile, target: Parameters<typeof storeAttachment>[2]): Promise<void> {
  try {
    const stored = await storeAttachment(db, await client.download(file), target);

    if (!stored.ok) {
      console.warn(`confluence: PBI-${target.adoId} ${file.fileName} skipped: ${stored.error}`);
    }
  } catch (error) {
    console.warn(`confluence: PBI-${target.adoId} ${file.fileName} skipped: ${(error as Error).message}`);
  }
}

async function reportFailure(db: AdoaDb, adoId: number, url: string, copies: AttachmentRow[], reason: string): Promise<void> {
  if (copies.length > 0) {
    console.warn(`confluence: PBI-${adoId} kept the fetched copy of ${url}: ${reason}`);

    return;
  }

  await createDocumentTask(db, adoId, url, reason);
}

// Earlier fetched copies of the link: their rows and their files in the Vault. The user's own uploads are never touched.
async function removeCopies(context: WorkerContext, copies: AttachmentRow[]): Promise<void> {
  if (copies.length === 0) {
    return;
  }

  const vault = new VaultWriter(context.vaultRoot);

  for (const copy of copies.filter((row) => row.vaultPath)) {
    await vault.remove(copy.vaultPath!);
  }

  await context.db.delete(attachment).where(inArray(attachment.id, copies.map((copy) => copy.id)));
}

function fetchedCopies(db: AdoaDb, adoId: number, url: string): Promise<AttachmentRow[]> {
  return db.select().from(attachment).where(and(eq(attachment.pbiId, adoId), eq(attachment.sourceUrl, url), eq(attachment.origin, "confluence")));
}

function isReadable(file: ConfluenceFile): boolean {
  return READABLE_EXTENSIONS.includes(extname(file.fileName).toLowerCase()) && file.sizeBytes <= MAX_ATTACHMENT_BYTES;
}

// Page titles become file names; characters Windows or Obsidian don't accept in names are replaced.
function fileSafe(title: string): string {
  return title.replace(/[\\/:*?"<>|#^[\]]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100) || "page";
}

import { MAX_ATTACHMENT_BYTES, type UploadedFile } from "@powerloom/attachments";
import type { Outcome } from "@powerloom/core";
import { extname } from "node:path";
import { privateHostProblem } from "./publicHost";

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 30_000;
const USER_AGENT = "Mozilla/5.0 (compatible; PowerLoom document reader)";

// The attachment readers pick a reader by extension; a download names its type in Content-Type.
const EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "text/html": ".html",
  "application/xhtml+xml": ".html",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "text/csv": ".csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

// A linked web document as a file the attachment readers take (user decision 2026-10-14: an agent's web fetch often
// can't read a PDF; PowerLoom's readers can). Every reason it can't be had is returned.
export async function downloadDocument(url: string): Promise<Outcome<UploadedFile>> {
  const response = await fetchPublic(url, 0);

  return response.ok ? toFile(url, response.value) : response;
}

// The file name a document from this link gets, e.g. hets2026-4-hets-270-271-release-summary.
export function documentSlug(url: string): string {
  if (!URL.canParse(url)) {
    return "page";
  }

  const { hostname, pathname } = new URL(url);
  const fileName = pathname.split("/").filter(Boolean).pop();
  const name = fileName ? fileName.replace(/\.[a-z0-9]+$/i, "") : hostname;

  return name.replace(/[^\w.-]+/g, "-").slice(0, 60) || "page";
}

// Redirects are followed by hand, so every hop is checked to be on the public web.
async function fetchPublic(url: string, hops: number): Promise<Outcome<Response>> {
  if (!URL.canParse(url)) {
    return { ok: false, error: `not a link: ${url}` };
  }

  const target = new URL(url);
  const problem = await privateHostProblem(target);

  if (problem) {
    return { ok: false, error: problem };
  }

  const response = await request(target);

  if (!response.ok) {
    return response;
  }

  if (isRedirect(response.value)) {
    return followRedirect(target, response.value, hops);
  }

  return response.value.ok ? response : { ok: false, error: `HTTP ${response.value.status}` };
}

function followRedirect(from: URL, response: Response, hops: number): Promise<Outcome<Response>> {
  const location = response.headers.get("location");

  if (!location || hops >= MAX_REDIRECTS) {
    return Promise.resolve({ ok: false, error: location ? "too many redirects" : `HTTP ${response.status} without a location` });
  }

  return fetchPublic(new URL(location, from).toString(), hops + 1);
}

async function request(target: URL): Promise<Outcome<Response>> {
  try {
    return { ok: true, value: await fetch(target, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": USER_AGENT } }) };
  } catch (error) {
    return { ok: false, error: `couldn't download it: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function isRedirect(response: Response): boolean {
  return response.status >= 300 && response.status < 400;
}

async function toFile(url: string, response: Response): Promise<Outcome<UploadedFile>> {
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const extension = EXTENSIONS[contentType] ?? extname(new URL(url).pathname).toLowerCase();
  const declaredSize = Number(response.headers.get("content-length") ?? 0);

  if (!extension) {
    return { ok: false, error: `can't read ${contentType || "an unknown type"}` };
  }

  if (declaredSize > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: `too large (${declaredSize} bytes)` };
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  return bytes.length > MAX_ATTACHMENT_BYTES
    ? { ok: false, error: `too large (${bytes.length} bytes)` }
    : { ok: true, value: { fileName: `${documentSlug(url)}${extension}`, contentType: contentType || "application/octet-stream", bytes } };
}

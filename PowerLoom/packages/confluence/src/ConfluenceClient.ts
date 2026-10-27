import type { ConfluenceCredentials } from "./models/ConfluenceCredentials";
import type { ConfluenceFile } from "./models/ConfluenceFile";
import type { ConfluencePage } from "./models/ConfluencePage";
import type { ConfluenceSearchHit } from "./models/ConfluenceSearchHit";
import { ConfluenceRequestError } from "./models/ConfluenceRequestError";
import type { DownloadedFile } from "./models/DownloadedFile";
import { confluencePageId, confluenceSite } from "./pageLinks";

const FILES_PAGE_SIZE = 100;
const MAX_SEARCH_HITS = 25;

// The answers Confluence gives for the usual problems, in words the user can act on.
const STATUS_REASONS: Record<number, string> = {
  401: "Confluence rejected the credentials (CONFLUENCE_EMAIL / CONFLUENCE_API_TOKEN in .env; an API token can expire)",
  403: "the Confluence account has no access to this page",
  404: "Confluence has no such page (moved, deleted, or not visible to the account)",
};

interface PageDto {
  id: string;
  title: string;
  version: { number: number };
  body?: { view?: { value?: string } };
}

interface FileDto {
  id: string;
  title: string;
  mediaType: string;
  fileSize: number;
  downloadLink: string;
}

interface SearchDto {
  results: { content?: { id: string; title: string }; url?: string; excerpt?: string }[];
}

interface FilesDto {
  results: FileDto[];
  _links?: { next?: string };
}

// Read-only Confluence Cloud REST client (API v2) for the pages a link points to. Never add write calls.
export class ConfluenceClient {
  private readonly authorization: string;
  private readonly trustedOrigin: string;

  constructor(credentials: ConfluenceCredentials) {
    const site = new URL(credentials.site);
    if (site.protocol !== "https:" || site.username || site.password) throw new ConfluenceRequestError(400, "CONFLUENCE_SITE must be a trusted HTTPS site");
    this.trustedOrigin = site.origin;
    this.authorization = `Basic ${Buffer.from(`${credentials.email}:${credentials.apiToken}`).toString("base64")}`;
  }

  // Null when the credentials aren't set, so the caller can say so instead of failing every call.
  static fromEnv(env: NodeJS.ProcessEnv = process.env): ConfluenceClient | null {
    const email = env.CONFLUENCE_EMAIL?.trim();
    const apiToken = env.CONFLUENCE_API_TOKEN?.trim();
    const site = env.CONFLUENCE_SITE?.trim();

    return email && apiToken && site ? new ConfluenceClient({ email, apiToken, site }) : null;
  }

  async page(url: string): Promise<ConfluencePage> {
    this.requireTrusted(url);
    const id = requirePageId(url);
    const page = await this.getJson<PageDto>(`${confluenceSite(url)}/wiki/api/v2/pages/${id}?body-format=view`);

    return { id: page.id, title: page.title, version: page.version.number, html: page.body?.view?.value ?? "" };
  }

  // Every file attached to the page (the API pages through them).
  async files(url: string): Promise<ConfluenceFile[]> {
    this.requireTrusted(url);
    const site = confluenceSite(url);
    const files: ConfluenceFile[] = [];
    let next: string | undefined = `/wiki/api/v2/pages/${requirePageId(url)}/attachments?limit=${FILES_PAGE_SIZE}`;

    const visited = new Set<string>();
    do {
      const target = new URL(next, site).href;
      if (visited.has(target)) throw new ConfluenceRequestError(502, "Confluence attachment pagination repeated a page");
      visited.add(target);
      const batch: FilesDto = await this.getJson<FilesDto>(target);

      files.push(...batch.results.map((file) => toFile(site, file)));
      next = batch._links?.next;
    } while (next);

    return files;
  }

  // Pages that match, title matches first, then full-text ones (Confluence's own ranking buries exact titles; v2 of the
  // API has no search, so this is CQL). `space` narrows it to one space key.
  async search(site: string, text: string, space: string | null, limit = 10): Promise<ConfluenceSearchHit[]> {
    const capped = Math.min(limit, MAX_SEARCH_HITS);
    const byTitle = await this.searchCql(site, `title ~ "${escapeCql(text)}"`, space, capped);
    const byText = await this.searchCql(site, `text ~ "${escapeCql(text)}"`, space, capped);
    const unique = [...byTitle, ...byText].filter((hit, index, all) => all.findIndex((other) => other.id === hit.id) === index);

    return unique.slice(0, capped);
  }

  private async searchCql(site: string, match: string, space: string | null, limit: number): Promise<ConfluenceSearchHit[]> {
    const spaceFilter = space ? ` AND space = "${escapeCql(space)}"` : "";
    const cql = `type = page AND ${match}${spaceFilter}`;
    const found = await this.getJson<SearchDto>(`${site}/wiki/rest/api/search?cql=${encodeURIComponent(cql)}&limit=${limit}`);

    return found.results
      .filter((hit) => hit.content)
      .map((hit) => ({ id: hit.content!.id, title: hit.content!.title, url: `${site}/wiki${hit.url ?? ""}`, excerpt: stripMarks(hit.excerpt ?? "") }));
  }

  async download(file: ConfluenceFile): Promise<DownloadedFile> {
    const response = await this.request(file.downloadUrl, "*/*");
    const contentType = response.headers.get("content-type") ?? file.mediaType;

    if (!response.ok) {
      throw failure(response.status, `download of ${file.fileName}`);
    }

    return { fileName: file.fileName, contentType, bytes: Buffer.from(await response.arrayBuffer()) };
  }

  private async getJson<T>(url: string): Promise<T> {
    const response = await this.request(url, "application/json");

    if (!response.ok) {
      throw failure(response.status, url);
    }

    return (await response.json()) as T;
  }

  private requireTrusted(url: string): URL {
    const target = new URL(url);
    if (target.protocol !== "https:" || target.origin !== this.trustedOrigin || target.username || target.password) {
      throw new ConfluenceRequestError(400, "Confluence target must belong to the trusted HTTPS CONFLUENCE_SITE");
    }
    return target;
  }

  private async request(url: string, accept: string): Promise<Response> {
    let target = this.requireTrusted(url);
    for (let hop = 0; hop <= 5; hop++) {
      const response = await fetch(target, { headers: { Authorization: this.authorization, Accept: accept }, redirect: "manual" });
      if (![301, 302, 303, 307, 308].includes(response.status)) return response;
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location) throw new ConfluenceRequestError(502, "Confluence redirect has no location");
      target = this.requireTrusted(new URL(location, target).href);
    }
    throw new ConfluenceRequestError(502, "Confluence redirected too many times");
  }
}

function requirePageId(url: string): string {
  const id = confluencePageId(url);

  if (!id) {
    throw new ConfluenceRequestError(400, "the link isn't a /pages/<id> link (short /wiki/x/ links can't be read; use the page's full link)");
  }

  return id;
}

function toFile(site: string, file: FileDto): ConfluenceFile {
  const link = file.downloadLink;
  const path = link.startsWith("/") && !link.startsWith("//") && !link.startsWith("/wiki/") ? `/wiki${link}` : link;
  return { id: file.id, fileName: file.title, mediaType: file.mediaType, sizeBytes: file.fileSize, downloadUrl: new URL(path, `${site}/wiki/`).href };
}

function escapeCql(value: string): string {
  return value.replace(/["\\]/g, (char) => `\\${char}`);
}

// Search excerpts mark the matches with @@@hl@@@ … @@@endhl@@@.
function stripMarks(excerpt: string): string {
  return excerpt.replace(/@@@(end)?hl@@@/g, "").replace(/\s+/g, " ").trim();
}

function failure(status: number, what: string): ConfluenceRequestError {
  return new ConfluenceRequestError(status, STATUS_REASONS[status] ?? `Confluence answered ${status} for ${what}`);
}

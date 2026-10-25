import type { DriveFile } from "./models/DriveFile";
import type { GoogleDriveClientOptions } from "./models/GoogleDriveClientOptions";
import type { GoogleDriveReader } from "./models/GoogleDriveReader";
import { DriveRequestError } from "./DriveRequestError";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FILES_URL = "https://www.googleapis.com/drive/v3/files";
const FILE_FIELDS = "id,name,mimeType,parents,modifiedTime,size,webViewLink";
const FOLDER_TYPE = "application/vnd.google-apps.folder";
// An access token is renewed a minute before Google says it expires.
const EXPIRY_MARGIN_MS = 60_000;
const ALL_DRIVES = "supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives";

// Google Drive's REST API, read only (the sign-in's scope is drive.readonly): the refresh token buys an access token
// per hour, kept for the client's life (one run or chat session).
export class GoogleDriveClient implements GoogleDriveReader {
  private access: { token: string; expiresAt: number } | null = null;

  constructor(private readonly options: GoogleDriveClientOptions, private readonly fetchFn: typeof fetch = fetch) {}

  async childFolders(parents: string[]): Promise<DriveFile[]> {
    return this.list(`(${parentsQuery(parents)}) and mimeType = '${FOLDER_TYPE}' and trashed = false`, 1000);
  }

  async search(parents: string[], text: string, limit: number): Promise<DriveFile[]> {
    const quoted = quote(text);

    return this.list(`(${parentsQuery(parents)}) and trashed = false and (name contains ${quoted} or fullText contains ${quoted})`, limit);
  }

  async get(id: string): Promise<DriveFile> {
    return fileOf(await this.json(`${FILES_URL}/${encodeURIComponent(id)}?fields=${FILE_FIELDS}&supportsAllDrives=true`));
  }

  async export(id: string, mimeType: string): Promise<string> {
    return (await this.request(`${FILES_URL}/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent(mimeType)}`)).text();
  }

  async download(id: string): Promise<Buffer> {
    return Buffer.from(await (await this.request(`${FILES_URL}/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`)).arrayBuffer());
  }

  private async list(query: string, limit: number): Promise<DriveFile[]> {
    const url = `${FILES_URL}?q=${encodeURIComponent(query)}&fields=files(${FILE_FIELDS})&pageSize=${Math.min(limit, 1000)}&orderBy=modifiedTime desc&${ALL_DRIVES}`;
    const body = (await this.json(url)) as { files?: unknown[] };

    return (body.files ?? []).map(fileOf);
  }

  private async json(url: string): Promise<unknown> {
    return (await this.request(url)).json();
  }

  private async request(url: string): Promise<Response> {
    const response = await this.fetchFn(url, { headers: { Authorization: `Bearer ${await this.token()}` } });

    if (!response.ok) {
      throw new DriveRequestError(response.status, `Google Drive answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }

    return response;
  }

  private async token(): Promise<string> {
    if (this.access && this.access.expiresAt > Date.now()) {
      return this.access.token;
    }

    const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: this.options.refreshToken, client_id: this.options.clientId, client_secret: this.options.clientSecret });
    const response = await this.fetchFn(TOKEN_URL, { method: "POST", body });

    if (!response.ok) {
      // A revoked or expired sign-in answers 400 invalid_grant: the user signs in again, so it counts as denied.
      throw new DriveRequestError(response.status === 400 ? 401 : response.status, `Google refused the sign-in (${response.status}): ${(await response.text()).slice(0, 300)}`);
    }

    const answer = (await response.json()) as { access_token: string; expires_in: number };

    this.access = { token: answer.access_token, expiresAt: Date.now() + answer.expires_in * 1000 - EXPIRY_MARGIN_MS };

    return this.access.token;
  }
}

function parentsQuery(parents: string[]): string {
  return parents.map((id) => `${quote(id)} in parents`).join(" or ");
}

// A Drive query string: backslashes and quotes escaped.
export function quote(text: string): string {
  return `'${text.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

function fileOf(raw: unknown): DriveFile {
  const file = raw as { id: string; name: string; mimeType: string; parents?: string[]; modifiedTime?: string; size?: string; webViewLink?: string };

  return { id: file.id, name: file.name, mimeType: file.mimeType, parents: file.parents ?? [], modifiedTime: file.modifiedTime ?? null, size: file.size ? Number(file.size) : null, webViewLink: file.webViewLink ?? null };
}

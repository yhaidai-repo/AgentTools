import type { DriveFile } from "./DriveFile";

// What the Drive tools read; GoogleDriveClient over the REST API, a fake in tests.
export interface GoogleDriveReader {
  /** The folders directly in any of `parents`. */
  childFolders(parents: string[]): Promise<DriveFile[]>;
  /** Files in any of `parents` whose name or text has `text`. */
  search(parents: string[], text: string, limit: number): Promise<DriveFile[]>;
  get(id: string): Promise<DriveFile>;
  /** A Google Docs, Sheets or Slides file as the given type (text/plain, text/csv). */
  export(id: string, mimeType: string): Promise<string>;
  download(id: string): Promise<Buffer>;
}

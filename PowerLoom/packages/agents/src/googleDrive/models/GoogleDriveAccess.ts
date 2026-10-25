import type { GoogleDriveReader } from "./GoogleDriveReader";

// The run's vault's Google Drive: the reader with its sign-in, and the folders agents may read (everything below them).
export interface GoogleDriveAccess {
  reader: GoogleDriveReader;
  folders: { id: string; name: string }[];
}

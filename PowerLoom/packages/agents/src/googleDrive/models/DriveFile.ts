// A Drive file or folder as the tools see it.
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  modifiedTime: string | null;
  size: number | null;
  webViewLink: string | null;
}

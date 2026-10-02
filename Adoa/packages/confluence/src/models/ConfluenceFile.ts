// A file attached to a Confluence page (not downloaded yet).
export interface ConfluenceFile {
  id: string;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  downloadUrl: string;
}

// One file to store on a PBI, as the web uploads it or a chat names it by path.
export interface AttachmentFile {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}

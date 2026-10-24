import type { UploadedFile } from "./UploadedFile";

// An upload with the text agents read (null for an image).
export interface ExtractedFile {
  file: UploadedFile;
  text: string | null;
}

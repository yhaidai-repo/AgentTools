import { extractAttachmentText, MAX_ATTACHMENT_BYTES } from "@powerloom/attachments";
import type { DriveFile } from "./models/DriveFile";
import type { GoogleDriveReader } from "./models/GoogleDriveReader";

// Google's own files are exported (Docs and Slides as text, Sheets as CSV, the first sheet); uploaded files are read
// like PBI attachments (PDF, Word, Excel, CSV, HTML, Markdown, text).
const EXPORTS: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.presentation": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
};

// An uploaded file named without its extension is read by its type.
const EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/csv": ".csv",
  "text/html": ".html",
  "text/markdown": ".md",
  "text/plain": ".txt",
};

export type DriveText = { ok: true; text: string } | { ok: false; error: string };

export async function driveFileText(reader: GoogleDriveReader, file: DriveFile): Promise<DriveText> {
  const exportType = EXPORTS[file.mimeType];

  if (exportType) {
    return { ok: true, text: await reader.export(file.id, exportType) };
  }

  if (file.mimeType.startsWith("application/vnd.google-apps.")) {
    return { ok: false, error: `${file.name} is a ${file.mimeType.replace("application/vnd.google-apps.", "Google ")} file, which has no text to read.` };
  }

  if ((file.size ?? 0) > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: `${file.name} is ${Math.ceil((file.size ?? 0) / 1024 / 1024)} MB; at most ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB are read.` };
  }

  return readUpload(reader, file);
}

async function readUpload(reader: GoogleDriveReader, file: DriveFile): Promise<DriveText> {
  const extension = EXTENSIONS[file.mimeType] ?? "";
  const fileName = extension && !file.name.toLowerCase().endsWith(extension) ? `${file.name}${extension}` : file.name;
  const extracted = await extractAttachmentText({ fileName, contentType: file.mimeType, bytes: await reader.download(file.id) });

  if (!extracted.ok) {
    return extracted;
  }

  return extracted.text === null ? { ok: false, error: `${file.name} is an image: there is no text to read.` } : { ok: true, text: extracted.text };
}

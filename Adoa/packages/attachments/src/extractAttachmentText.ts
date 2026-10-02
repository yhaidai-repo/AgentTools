import { htmlToMarkdown } from "@adoa/vault";
import mammoth from "mammoth";
import { extname } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { ACCEPTED_EXTENSIONS, IMAGE_EXTENSIONS, MAX_ATTACHMENT_BYTES } from "./limits";
import type { ExtractedText } from "./models/ExtractedText";
import type { UploadedFile } from "./models/UploadedFile";

type Reader = (bytes: Buffer) => Promise<string | null>;


const READERS: Record<string, Reader> = {
  ".pdf": readPdf,
  ".docx": readDocx,
  ".html": readHtml,
  ".htm": readHtml,
  ".md": readPlainText,
  ".markdown": readPlainText,
  ".txt": readPlainText,
};

// Converts an upload into the text agents read. Every reason a file can't be used is returned, never swallowed.
export async function extractAttachmentText(file: UploadedFile): Promise<ExtractedText> {
  const extension = extname(file.fileName).toLowerCase();
  const problem = checkFile(file, extension);

  if (problem) {
    return { ok: false, error: problem };
  }

  if (IMAGE_EXTENSIONS.includes(extension)) {
    return { ok: true, text: null };
  }

  return readText(file, READERS[extension]);
}

function checkFile(file: UploadedFile, extension: string): string | null {
  if (file.bytes.length === 0) {
    return `${file.fileName} is empty.`;
  }

  if (file.bytes.length > MAX_ATTACHMENT_BYTES) {
    return `${file.fileName} is larger than ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`;
  }

  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    return `${file.fileName}: unsupported file type. Use ${ACCEPTED_EXTENSIONS.join(", ")}.`;
  }

  return null;
}

async function readText(file: UploadedFile, reader: Reader): Promise<ExtractedText> {
  try {
    const text = (await reader(file.bytes))?.trim() ?? "";

    if (text.length === 0) {
      return { ok: false, error: `${file.fileName} has no readable text (a scanned PDF or an empty document?).` };
    }

    return { ok: true, text };
  } catch (error) {
    return { ok: false, error: `${file.fileName} could not be read: ${(error as Error).message}` };
  }
}

async function readPdf(bytes: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });

  return text;
}

async function readDocx(bytes: Buffer): Promise<string> {
  const { value } = await mammoth.convertToHtml({ buffer: bytes });

  return htmlToMarkdown(value);
}

async function readHtml(bytes: Buffer): Promise<string> {
  return htmlToMarkdown(await readPlainText(bytes));
}

// fatal: a binary file renamed to .txt is rejected instead of being stored as garbage.
async function readPlainText(bytes: Buffer): Promise<string> {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

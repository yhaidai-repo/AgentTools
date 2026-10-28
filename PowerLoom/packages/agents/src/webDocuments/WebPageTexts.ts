import { extractAttachmentText } from "@powerloom/attachments";
import type { Outcome } from "@powerloom/core";
import { downloadDocument } from "./documentDownload";

// One run's public web pages as text: PowerLoom downloads a page and reads it with the attachment readers (PDF, Word,
// Excel, HTML), which read what an agent's own web fetch often can't, e.g. a compressed PDF (2026-10-14). Shared by
// fetch_document and read_web_page, so a page is downloaded once per run, whichever tool reads it.
export class WebPageTexts {
  private readonly texts = new Map<string, string>();

  constructor(private readonly read: (url: string) => Promise<Outcome<string>> = readPage) {}

  async textOf(url: string): Promise<Outcome<string>> {
    const known = this.texts.get(url);

    if (known !== undefined) {
      return { ok: true, value: known };
    }

    const read = await this.read(url);

    if (read.ok) {
      this.texts.set(url, read.value);
    }

    return read;
  }
}

async function readPage(url: string): Promise<Outcome<string>> {
  const file = await downloadDocument(url);

  if (!file.ok) {
    return file;
  }

  const extracted = await extractAttachmentText(file.value);

  if (!extracted.ok) {
    return { ok: false, error: extracted.error };
  }

  return extracted.text === null ? { ok: false, error: "it is an image" } : { ok: true, value: extracted.text };
}

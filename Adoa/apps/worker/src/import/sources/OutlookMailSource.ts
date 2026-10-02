import path from "node:path";
import { parseImportRequest, type Outcome, type PbiImportRequest } from "@adoa/core";
import type { OutlookMail } from "../../models/OutlookMail";
import { FolderImportSource } from "./FolderImportSource";

const OUTLOOK_FOLDER = "outlook";

// Mails the Outlook exporter (tools/outlook-export) dumps into <inbox>/outlook (user decision 2026-10-02: classic
// Outlook on the PC, Inbox mails by subject). Each mail's work item links name its PBIs.
export class OutlookMailSource extends FolderImportSource {
  constructor(inboxRoot: string) {
    super("outlook", path.join(inboxRoot, OUTLOOK_FOLDER));
  }

  protected toRequest(content: unknown, file: string): Outcome<PbiImportRequest> {
    const mail = content as Partial<OutlookMail> | null;

    if (!mail?.entryId || (!mail.html && !mail.text)) {
      return { ok: false, error: "Not an Outlook mail: entryId and html or text are required." };
    }

    // The Internet Message-ID survives moves between folders; the entry id is the fallback. Checked like any request.
    const request = {
      source: this.id,
      sourceRef: mail.internetMessageId || mail.entryId,
      title: mail.subject,
      from: mail.sender,
      occurredAt: mail.received,
      html: mail.html,
      text: mail.text,
    };

    return parseImportRequest(request, file);
  }
}

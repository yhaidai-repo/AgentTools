// One mail as the Outlook exporter (tools/outlook-export) writes it: raw mail facts; the outlook source maps them to a
// PbiImportRequest.
export interface OutlookMail {
  entryId: string;
  internetMessageId?: string;
  subject?: string;
  sender?: string;
  /** ISO time the mail was received. */
  received?: string;
  messageClass?: string;
  html?: string;
  text?: string;
}

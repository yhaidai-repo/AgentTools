import path from "node:path";
import type { PbiImportSource } from "../models/PbiImportSource";
import { InboxRequestSource } from "./sources/InboxRequestSource";
import { OutlookMailSource } from "./sources/OutlookMailSource";

// Every import source a vault's pbi-import job reads, in this order, from the vault's folder of the import inbox (the
// inbox root when it has none; user decision 2026-10-05). A new source is one class and one line here.
export function importSources(inboxRoot: string, importFolder: string | null): PbiImportSource[] {
  const root = importFolder ? path.join(inboxRoot, importFolder) : inboxRoot;

  return [new OutlookMailSource(root), new InboxRequestSource(root)];
}

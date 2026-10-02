import type { PbiImportSource } from "../models/PbiImportSource";
import { InboxRequestSource } from "./sources/InboxRequestSource";
import { OutlookMailSource } from "./sources/OutlookMailSource";

// Every import source the pbi-import job reads, in this order. A new source is one class and one line here.
export function importSources(inboxRoot: string): PbiImportSource[] {
  return [new OutlookMailSource(inboxRoot), new InboxRequestSource(inboxRoot)];
}

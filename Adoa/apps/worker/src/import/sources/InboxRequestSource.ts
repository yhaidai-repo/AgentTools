import { parseImportRequest, type Outcome, type PbiImportRequest } from "@adoa/core";
import { FolderImportSource } from "./FolderImportSource";

// Any tool's PbiImportRequest as a JSON file at the import inbox root; a file without a sourceRef uses its file name.
export class InboxRequestSource extends FolderImportSource {
  constructor(inboxRoot: string) {
    super("inbox", inboxRoot);
  }

  protected toRequest(content: unknown, file: string): Outcome<PbiImportRequest> {
    return parseImportRequest(content, file);
  }
}

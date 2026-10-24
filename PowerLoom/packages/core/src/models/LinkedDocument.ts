import type { LinkedDocumentKind } from "./LinkedDocumentKind";

export interface LinkedDocument {
  url: string;
  kind: LinkedDocumentKind;
}

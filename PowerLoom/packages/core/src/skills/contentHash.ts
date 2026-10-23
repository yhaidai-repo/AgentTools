import { createHash } from "node:crypto";

// A save passes back the hash of the content it edited, so two editors don't overwrite each other's change.
export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

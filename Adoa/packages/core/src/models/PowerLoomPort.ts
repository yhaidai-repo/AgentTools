import type { ChatLaunch } from "./ChatLaunch";
import type { ChatTarget } from "./ChatTarget";
import type { Outcome } from "./Outcome";

// PowerLoom, the .NET backend taking over the worker's jobs (the vault's adoa-backend-delivery note). The caller (the
// web, the CLI) supplies the client; core stays free of HTTP.
export interface PowerLoomPort {
  // Queues a stored record for its vault's file: the WWW log, or a finding into a project's register.
  addRecord(kind: "www" | "open-question" | "known-issue", sourceId: string): Promise<void>;
  // "Continue with <agent>": writes the chat note and returns the link that opens the chat.
  openChat(target: ChatTarget): Promise<Outcome<ChatLaunch>>;
}

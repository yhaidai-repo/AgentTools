import type { ChatLaunch } from "./ChatLaunch";
import type { CloseItemRequest } from "./CloseItemRequest";
import type { ItemStatus } from "./ItemStatus";
import type { ReportBugInput } from "./ReportBugInput";
import type { ReportedBug } from "./ReportedBug";
import type { ChatTarget } from "./ChatTarget";
import type { Outcome } from "./Outcome";

// PowerLoom, the .NET backend taking over the worker's jobs (the vault's adoa-backend-delivery note). The caller (the
// web, the CLI) supplies the client; core stays free of HTTP.
export interface PowerLoomPort {
  // Queues a stored record for its vault's file: the WWW log, or a finding into a project's register.
  addRecord(kind: "www" | "open-question" | "known-issue", sourceId: string): Promise<void>;
  // "Continue with <agent>": writes the chat note and returns the link that opens the chat.
  openChat(target: ChatTarget): Promise<Outcome<ChatLaunch>>;
  // Deletes the PBI in adoa (data now, its notes right after); refused while an agent runs on it.
  deletePbi(adoId: number): Promise<Outcome<string>>;
  // Closes a question, finding or human task with the person's answer; `dryRun` only checks that it can be closed.
  closeItem(request: CloseItemRequest, dryRun?: boolean): Promise<Outcome<{ status: ItemStatus }>>;
  // Opens a finished, failed or blocked agent task again.
  rerunTask(adoId: number | null, itemId: string): Promise<Outcome<string>>;
  // Soft-deletes a question or task.
  deleteItem(adoId: number | null, itemId: string): Promise<Outcome<string>>;
  // Files a bug under a PBI as a [BUG] child item, prepared right away.
  reportBug(input: ReportBugInput, actor: string): Promise<Outcome<ReportedBug>>;
}

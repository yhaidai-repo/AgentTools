import type { ChatLaunch } from "./ChatLaunch";
import type { CloseItemRequest } from "./CloseItemRequest";
import type { CreatePbiInput } from "./CreatePbiInput";
import type { PbiFeedback } from "./PbiFeedback";
import type { PbiSkillChoices } from "./PbiSkillChoices";
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
  // Deletes the PBI in PowerLoom (data now, its notes right after); refused while an agent runs on it.
  deletePbi(adoId: number): Promise<Outcome<string>>;
  // Closes a question, finding or human task with the person's answer; `dryRun` only checks that it can be closed.
  closeItem(request: CloseItemRequest, dryRun?: boolean): Promise<Outcome<{ status: ItemStatus }>>;
  // Opens a finished, failed or blocked agent task again.
  rerunTask(adoId: number | null, itemId: string): Promise<Outcome<string>>;
  // Soft-deletes a question or task.
  deleteItem(adoId: number | null, itemId: string): Promise<Outcome<string>>;
  // Files a bug under a PBI as a [BUG] child item, prepared right away.
  reportBug(input: ReportBugInput, actor: string): Promise<Outcome<ReportedBug>>;
  // Answers a code-review comment (an empty answer takes it back); the comment's pull request.
  answerReviewComment(commentId: string, answer: string | null): Promise<Outcome<{ prId: number; answered: boolean }>>;
  // Deletes a pull request's review from PowerLoom; the deleted PR's title.
  deleteReview(prId: number): Promise<Outcome<string>>;
  // A PBI created in PowerLoom (a child of parentId goes to the parent's vault).
  createPbi(input: CreatePbiInput, actor: string): Promise<Outcome<{ adoId: number }>>;
  // Finishes a PBI with the user's feedback; the WWW record id when something went wrong.
  finishPbi(feedback: PbiFeedback, actor: string): Promise<Outcome<{ message: string; wwwRecordId: number | null }>>;
  // The user's repo list for a PBI; the number saved.
  savePbiRepos(adoId: number, repos: string[]): Promise<Outcome<number>>;
  // The user's skill list for a PBI; the number saved.
  savePbiSkills(choices: PbiSkillChoices): Promise<Outcome<number>>;
}

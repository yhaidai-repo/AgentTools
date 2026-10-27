import type { ChatLaunch } from "./ChatLaunch";
import type { CloseItemRequest } from "./CloseItemRequest";
import type { CreatePbiInput } from "./CreatePbiInput";
import type { PbiFeedback } from "./PbiFeedback";
import type { PbiSkillChoices } from "./PbiSkillChoices";
import type { ItemStatus } from "./ItemStatus";
import type { ReportBugInput } from "./ReportBugInput";
import type { ReportedBug } from "./ReportedBug";
import type { ChatTarget } from "./ChatTarget";
import type { DeadLetter } from "./DeadLetter";
import type { Outcome } from "./Outcome";
import type { SavedSkill } from "./SavedSkill";
import type { SystemStatus } from "./SystemStatus";
import type { AgentWorkPort } from "./AgentWorkPort";
import type { CaptureWorkPort } from "./CaptureWorkPort";
import type { PbiWorkPort } from "./PbiWorkPort";
import type { ReviewWorkPort } from "./ReviewWorkPort";
import type { TaskWorkPort } from "./TaskWorkPort";
import type { VaultWorkPort } from "./VaultWorkPort";

// PowerLoom, the .NET backend taking over the worker's jobs (the vault's adoa-backend-delivery note). The caller (the
// web, the MCP server) supplies the client; core stays free of HTTP.
export interface PowerLoomPort extends PbiWorkPort, TaskWorkPort, ReviewWorkPort, VaultWorkPort, CaptureWorkPort, AgentWorkPort {
  // Queues a stored record for its vault's file: the WWW log, or a finding into a project's register.
  addRecord(kind: "www" | "open-question" | "known-issue", sourceId: string): Promise<void>;
  // "Continue with <agent>": writes the chat note and returns the link that opens the chat.
  openChat(target: ChatTarget): Promise<Outcome<ChatLaunch>>;
  // Deletes the PBI in PowerLoom (data now, its notes right after); refused while an agent runs on it.
  deletePbi(adoId: number): Promise<Outcome<string>>;
  // Closes the PBI in PowerLoom (kept for the agents, open items but findings cancelled, open children closed); what was done.
  closePbi(adoId: number, actor: string): Promise<Outcome<string>>;
  // Reopens a PBI the user closed, as new; what was done.
  reopenPbi(adoId: number, actor: string): Promise<Outcome<string>>;
  // Closes a question, finding or human task with the person's answer; `dryRun` only checks that it can be closed.
  closeItem(request: CloseItemRequest, dryRun?: boolean): Promise<Outcome<{ status: ItemStatus }>>;
  // Opens a finished, failed or blocked agent task again; `startOver`: its next run neither continues the last run's conversation nor gets its result.
  rerunTask(adoId: number | null, itemId: string, startOver: boolean): Promise<Outcome<string>>;
  // Stops the agent task's run in progress; the run keeps what it has and the task is blocked until it is Re-run.
  stopTask(itemId: string): Promise<Outcome<string>>;
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

  // A new skill of PowerLoom's own: `<name>/SKILL.md` in its skills folder (user decision 2026-10-23).
  createSkill(name: string, content: string): Promise<Outcome<string>>;
  // Rewrites one of PowerLoom's own skills; `hash` is the content the caller read (a stale one is refused), the
  // replaced text becomes a revision.
  saveSkill(name: string, content: string, hash: string): Promise<Outcome<SavedSkill>>;
  // Puts a revision's text back as the skill (the current text becomes a revision too).
  restoreSkill(name: string, revisionId: number, hash: string): Promise<Outcome<SavedSkill>>;
  // Dispatches the agent now, as its schedule would: its open tasks are validated and the valid ones started.
  runAgent(agentId: string): Promise<Outcome<{ agentId: string; openTasks: number; message: string }>>;

  // PowerLoom's view of the running system (the dashboard's Application tab); a failure when PowerLoom itself doesn't answer.
  status(): Promise<Outcome<SystemStatus>>;
  // Messages PowerLoom gave up on (Wolverine's dead letters) sent since `since`: the errors outside a single run.
  deadLetters(since: Date): Promise<Outcome<DeadLetter[]>>;
}

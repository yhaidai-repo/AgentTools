import type { AgentEvent, ToolDefinition } from "@agenttools/runtime";
import { localItem } from "@powerloom/db";
import { createAdoTools } from "../ado/adoTools";
import type { AgentRunSession } from "../AgentRunSession";
import { createAttachmentTool } from "../attachmentTools";
import { createAzureTools } from "../azure/azureTools";
import { createConfluenceTools } from "../confluenceTools";
import { createDevHubTools } from "../devHubTools";
import { DuplicateGuard } from "../DuplicateGuard";
import { commitEstimate } from "../estimate/commitEstimate";
import { createEstimateTools, offersEstimate } from "../estimate/estimateTool";
import { RunEstimate } from "../estimate/RunEstimate";
import { ReadLog } from "../evidence/ReadLog";
import { recordReads } from "../evidence/recordReads";
import type { CaptureDraft } from "../models/CaptureDraft";
import type { TaskContext } from "../models/TaskContext";
import { createReadPbiTool } from "../pbiContext/readPbiTool";
import { listReposTool } from "../refinement/refinementTools";
import { createSqlTools } from "../sqlTools";
import { createAgentDocTools, outsideAccessContext } from "../stage";
import { addRunOutputs } from "../tasks/runOutputs";
import { commitCreatedTasks } from "../taskCreation/commitCreatedTasks";
import { createTaskTool } from "../taskCreation/createTaskTool";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import type { TaskCreationLimits } from "../taskCreation/models/TaskCreationLimits";
import { commitCaptures, createVaultCaptureTool } from "../vaultCapture";
import { createFetchDocumentTools } from "../webDocuments/fetchDocumentTool";
import type { WebDocumentRun } from "../webDocuments/models/WebDocumentRun";
import { createWebDocumentTools } from "../webDocuments/webDocumentTools";
import { webDocumentRun, webDocumentsBlock } from "../webDocuments/webDocuments";
import type { CommittedToolset } from "./models/CommittedToolset";
import type { ToolsetInput } from "./models/ToolsetInput";
import { depthOf, taskLimits } from "./taskLimits";

type ItemRow = typeof localItem.$inferSelect;

// The tools every agent gets from its Config alone (user decision 2026-10-14: the user gives any agent any tool, no
// runner decides on its own): docs, the repos it opened plus the vault's catalog, its PBI, every integration switched
// on, the PBI's web pages, vault drafts, record_estimate when granted, and create_task for the task types it may create. A
// runner adds only its own result tools. Reads are recorded, so create_task's evidence can cite them in every agent.
export class AgentToolset {
  readonly tasks: CreatedTask[];
  readonly captures: CaptureDraft[];
  /** What record_estimate recorded; committed with commit(). */
  readonly estimate: RunEstimate;
  private log: ReadLog | null = null;

  private constructor(
    private readonly context: TaskContext,
    private readonly session: AgentRunSession,
    private readonly task: ItemRow,
    private readonly input: ToolsetInput,
    private readonly webDocuments: WebDocumentRun | null,
    private readonly guard: DuplicateGuard,
    private readonly limits: TaskCreationLimits,
  ) {
    this.tasks = input.tasks ?? [];
    this.captures = input.captures ?? [];
    this.estimate = new RunEstimate(offersEstimate(context.agent, task.pbiId));
  }

  static async open(context: TaskContext, session: AgentRunSession, task: ItemRow, input: ToolsetInput): Promise<AgentToolset> {
    const depth = input.depth ?? depthOf(task);
    const webDocuments = await webDocumentRun(context, task, session.runId);
    const guard = input.guard ?? (task.pbiId === null ? DuplicateGuard.none() : await DuplicateGuard.load(context.deps.db, task.pbiId));
    const limits = await taskLimits(context, task.pbiId, depth);

    return new AgentToolset(context, session, task, input, webDocuments, guard, limits);
  }

  /** The first message's block of the PBI's web pages still to read; empty when there are none. */
  webDocumentsBlock(): string {
    return webDocumentsBlock(this.webDocuments);
  }

  /** The shared tools, once the first message is final: it is source S0 of the read log. */
  tools(firstMessage: string): ToolDefinition<any>[] {
    this.log = new ReadLog(firstMessage);

    return [...recordReads(this.readingTools(), this.log), ...this.context.skills.tools, ...this.writingTools(this.log)];
  }

  /** What the run has read, for the runner's own result tools; exists once tools() was called. */
  get readLog(): ReadLog {
    if (!this.log) {
      throw new Error("the toolset's read log exists once tools() was called with the first message");
    }

    return this.log;
  }

  observe(event: AgentEvent): void {
    this.log?.observe(event);
  }

  /** Writes what the shared tools noted into arrays of its own (a runner that lent its draft's arrays commits those with
   *  the draft): the tasks created, the drafts captured, both listed in the run's outputs; and the estimate. */
  async commit(runId: number): Promise<CommittedToolset> {
    const { deps } = this.context;
    const repos = this.input.repos.repos.map((repo) => repo.name);
    const target = { pbiId: this.task.pbiId, vault: this.task.vault, parentTaskId: this.task.id, runId, depth: this.limits.depth, docsVault: deps.docsVaultName, repos };
    const taskIds = await commitCreatedTasks(deps.db, target, this.input.tasks ? [] : this.tasks);
    const captureIds = this.input.captures || this.task.pbiId === null ? [] : await commitCaptures(deps.db, runId, this.task.pbiId, this.task.id, this.captures);

    await addRunOutputs(deps.db, runId, [...taskIds, ...captureIds]);
    await commitEstimate(deps.db, { pbiId: this.task.pbiId, runId, agent: this.context.agent.id }, this.estimate.latest);

    return { taskIds, captureIds };
  }

  private readingTools(): ToolDefinition<any>[] {
    const { deps, agent } = this.context;
    const access = outsideAccessContext(agent.id, this.session.runId, this.task);

    return [
      ...createAgentDocTools(deps, agent.id, this.session.runId, this.input.docsRoot),
      ...this.input.repos.tools,
      ...this.catalogTools(),
      ...this.pbiTools(),
      createReadPbiTool(deps.db, deps.vaultRoot),
      ...createConfluenceTools(deps, agent, access),
      ...createSqlTools(deps, agent, access),
      ...createAzureTools(deps, agent, access),
      ...createDevHubTools(deps, agent, access),
      ...createAdoTools(deps, agent, access),
      ...createFetchDocumentTools(this.webDocuments),
    ];
  }

  // The vault's catalog of enabled repos: what open_repo can add, and what refinement names in its repos.
  private catalogTools(): ToolDefinition<any>[] {
    return [listReposTool(this.context.deps.db, this.task.vault)];
  }

  private pbiTools(): ToolDefinition<any>[] {
    return this.task.pbiId === null ? [] : [createAttachmentTool(this.context.deps.db, this.task.pbiId)];
  }

  private writingTools(log: ReadLog): ToolDefinition<any>[] {
    const { deps, agent } = this.context;
    const hasCreateTask = this.input.createTask ?? agent.canAssign.length > 0;

    return [
      ...(hasCreateTask ? [createTaskTool(agent.canAssign, this.tasks, this.guard, log, this.limits)] : []),
      ...createWebDocumentTools(deps.db, this.webDocuments),
      ...(deps.captureRules && this.task.pbiId !== null ? [createVaultCaptureTool(this.captures, deps.captureRules)] : []),
      ...createEstimateTools(this.estimate),
    ];
  }
}

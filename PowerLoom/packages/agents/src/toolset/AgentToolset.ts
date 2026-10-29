import type { AgentEvent, ToolDefinition } from "@agenttools/runtime";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OfferedTool } from "@powerloom/core";
import { localItem } from "@powerloom/db";
import { ADO_INTEGRATION, createAdoTools } from "../ado/adoTools";
import type { AgentRunSession } from "../AgentRunSession";
import { createAttachmentTool } from "../attachmentTools";
import { createAzureTools } from "../azure/azureTools";
import { RESEARCH_RESULT_INTEGRATION, ResearchResultWriter } from "../betterResearch/ResearchResultWriter";
import { TechWriterWriter, WRITE_NOTES_INTEGRATION } from "../techWriter/TechWriterWriter";
import { VAULT_REVIEW_INTEGRATION, VaultReviewWriter } from "../vaultReview/VaultReviewWriter";
import { DesignWriter, WRITE_DESIGN_INTEGRATION } from "../design/DesignWriter";
import { RefinementWriter, WRITE_REFINEMENT_INTEGRATION } from "../betterRefinement/RefinementWriter";
import { CODE_REVIEW_INTEGRATION, ReviewWriter } from "../codeReview/ReviewWriter";
import { BETTER_REVIEW_INTEGRATION, BetterReviewWriter } from "../betterReview/BetterReviewWriter";
import { DEMONSTRATION_INTEGRATION, DemonstrationWriter } from "../demonstration/DemonstrationWriter";
import { demonstrationTools } from "../demonstration/toolPolicy";
import { AUTOTEST_INTEGRATION, AutotestWriter } from "../autotest/AutotestWriter";
import { ownTools } from "./ownTools";
import { CONFLUENCE_INTEGRATION, createConfluenceTools } from "../confluenceTools";
import { DEVHUB_INTEGRATION, createDevHubTools } from "../devHubTools";
import { SANDBOX_INTEGRATION, createSandboxTools } from "../sandbox/sandboxTools";
import { LiveTestRun } from "../liveTest/LiveTestRun";
import { LIVE_TEST_INTEGRATION } from "../liveTest/liveTestTools";
import { DuplicateGuard } from "../DuplicateGuard";
import { DbFailureReportStore } from "../failureReport/DbFailureReportStore";
import { FailureReportRun } from "../failureReport/FailureReportRun";
import { createReportFailureTool } from "../failureReport/reportFailureTool";
import { commitEstimate } from "../estimate/commitEstimate";
import { createEstimateTools, ESTIMATE_INTEGRATION, offersEstimate } from "../estimate/estimateTool";
import { RunEstimate } from "../estimate/RunEstimate";
import { withLimitNotes } from "../limits/limitNotes";
import type { RunUse } from "../limits/models/RunUse";
import { RunMeter } from "../limits/RunMeter";
import { ReadLog } from "../evidence/ReadLog";
import { recordReads } from "../evidence/recordReads";
import type { CaptureDraft } from "../models/CaptureDraft";
import type { TaskContext } from "../models/TaskContext";
import { createReadPbiTool } from "../pbiContext/readPbiTool";
import { commitResult } from "../result/commitResult";
import { createResultTool, RESULT_TOOL } from "../result/resultTool";
import { RunResult } from "../result/RunResult";
import { listReposTool } from "../refinement/refinementTools";
import { READ_REPOS_INTEGRATION } from "../repos/openRepos";
import { createSqlTools, READ_SQL_INTEGRATION } from "../sqlTools";
import { createGitHubReadTools, GITHUB_READ_INTEGRATION } from "../github/githubReadTools";
import { createGitHubWriteTools, GITHUB_WRITE_INTEGRATION } from "../github/githubWriteTools";
import { GitHubWorkspace } from "../github/GitHubWorkspace";
import { createGoogleDriveTools, GOOGLE_DRIVE_INTEGRATION } from "../googleDrive/googleDriveTools";
import { createAgentDocTools, outsideAccessContext } from "../stage";
import { EVERY_AGENT, runRef, type RunHandoff } from "@powerloom/core";
import { addRunOutputs } from "../tasks/runOutputs";
import { commitStep } from "../tasks/commitStep";
import { commitCreatedTasks, resolveTask } from "../taskCreation/commitCreatedTasks";
import { createTaskTool } from "../taskCreation/createTaskTool";
import { createHandOffTool } from "../handoff/handOffTool";
import { joinAskedToReceivers } from "../handoff/askedDependencies";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import type { TaskCreationLimits } from "../taskCreation/models/TaskCreationLimits";
import { commitCaptures, createVaultCaptureTool } from "../vaultCapture";
import { createFetchDocumentTools } from "../webDocuments/fetchDocumentTool";
import type { WebDocumentRun } from "../webDocuments/models/WebDocumentRun";
import { createWebDocumentTools } from "../webDocuments/webDocumentTools";
import { webDocumentRun, webDocumentsBlock } from "../webDocuments/webDocuments";
import { WebPageTexts } from "../webDocuments/WebPageTexts";
import { createReadWebPageTools } from "../webSearch/readWebPageTool";
import { createWebSearchTools } from "../webSearch/webSearchTools";
import { POWERLOOM_WEB_INTEGRATION } from "../webSearch/powerloomWebIntegration";
import type { CommittedToolset } from "./models/CommittedToolset";
import type { ToolGroup } from "./models/ToolGroup";
import type { RunWriter } from "./models/RunWriter";
import type { WriterSettlement } from "./models/WriterSettlement";
import type { WriterTarget } from "./models/WriterTarget";
import type { ToolsetInput } from "./models/ToolsetInput";
import { depthOf, taskLimits } from "./taskLimits";
import { grantSource, HAND_ON_SOURCE, offeredTools, READ_AZURE_SOURCE, SKILLS_SOURCE, toolsOf } from "./toolSources";

type ItemRow = typeof localItem.$inferSelect;

// The tools every agent gets from its Config alone (user decision 2026-10-14: the user gives any agent any tool, no
// runner decides on its own): docs, the repos it opened plus the vault's catalog, its PBI, every integration switched
// on, the PBI's web pages, vault drafts, record_estimate when granted, hand_off to a person or the task types it may
// create, create_task for those task types, and write_result for what the run produced. A runner adds only its own result tools. Reads are recorded, so create_task's
// evidence can cite them in every agent.
export class AgentToolset {
  readonly tasks: CreatedTask[];
  readonly captures: CaptureDraft[];
  /** What record_estimate recorded; committed with commit(). */
  readonly estimate: RunEstimate;
  /** What write_result recorded; committed with commit(). */
  readonly result = new RunResult();
  /** The turns the run has used and its latest words (a limit stop's partial result). */
  readonly meter = new RunMeter();
  /** The output tools the Config grants (write_research_result, …), each committed with commit(). */
  private readonly writers: RunWriter[];
  /** What report_failure has recorded in this run: its cap and one report per cause. */
  private readonly failureReports = new FailureReportRun();
  /** PowerLoom's commands against the live system, when the Config grants powerloomLiveTest. */
  private readonly liveTest: LiveTestRun | null;
  private log: ReadLog | null = null;
  private offer: OfferedTool[] = [];
  /** The run's GitHub working copies while its agent has GitHub (write); removed by cleanUp(). */
  private readonly gitHub: GitHubWorkspace | null;
  private readonly committedSettlements = new Map<string, WriterSettlement | null>();
  /** The web pages the run read, shared by fetch_document and read_web_page. */
  private readonly webPages = new WebPageTexts();

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
    this.writers = input.writers ?? grantedWriters(context);
    this.gitHub = context.agent.capabilities.integrations?.[GITHUB_WRITE_INTEGRATION] === true ? new GitHubWorkspace(context.deps.repoCache, session.runId, task.id, `PowerLoom (${context.agent.label})`) : null;
    this.liveTest = input.liveTest === undefined ? LiveTestRun.granted(context.agent, context.deps) : input.liveTest;
  }

  /** Removes what the run left on this PC (its GitHub working copies); what it pushed stays on GitHub. */
  async cleanUp(): Promise<void> {
    await this.gitHub?.cleanUp();
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

  /** The shared tools, once the first message is final: it is source S0 of the read log. Each result ends with what the
   *  run has used of its turns and budget. */
  tools(firstMessage: string): ToolDefinition<any>[] {
    this.log = new ReadLog(firstMessage);

    const reading = this.readingGroups();
    const writing = [{ source: SKILLS_SOURCE, tools: this.context.skills.tools }, ...this.writingGroups(this.log)];
    const live = this.liveTestGroups([...toolsOf(reading), ...toolsOf(writing)]);

    this.offer = offeredTools([...reading, live.reads, ...writing, live.writes]);

    return withLimitNotes([...recordReads(toolsOf([...reading, live.reads]), this.log), ...toolsOf([...writing, live.writes])], () => this.use(), RESULT_TOOL);
  }

  /** What tools() gave the run, each with what gave it, for the Tools tab. */
  get offered(): OfferedTool[] {
    return this.offer;
  }

  /** Removes what the live test created and records it in the trace; a no-op without a live test or once it holds
   *  nothing. Never throws: the run's own outcome stands. */
  async cleanUpLiveTest(): Promise<void> {
    if (!this.liveTest?.holdsData) {
      return;
    }

    try {
      await this.session.phase("live-test-cleanup", { ...(await this.liveTest.cleanUp()) });
    } catch (error) {
      console.error(`live-test cleanup of RUN-${this.session.runId} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
    this.meter.observe(event);
  }

  /** Writes what the shared tools noted into arrays of its own (a runner that lent its draft's arrays commits those with
   *  the draft): the tasks created, the drafts captured, the result, all listed in the run's outputs; and the estimate. */
  async commit(runId: number, stoppedEarly = false): Promise<CommittedToolset> {
    const { deps } = this.context;
    const repos = this.input.repos.repos.map((repo) => repo.name);
    const target = { pbiId: this.task.pbiId, vault: this.task.vault, parentTaskId: this.task.id, agent: this.context.agent.id, runId, depth: this.limits.depth, docsVault: deps.docsVaultName, repos };
    const root = this.session.commitRootRunId ?? runId;
    const taskIds: string[] = [];
    for (const task of this.input.tasks ? [] : this.tasks) {
      // Include IDs recovered from prior receipts in both dependency resolution and journal identity.
      const resolved = resolveTask(task, taskIds);
      taskIds.push(...await commitStep(deps.db, root, runId, "task", resolved, async tx => {
        const ids = await commitCreatedTasks(tx, target, [resolved]);
        await addRunOutputs(tx, runId, ids);
        return ids;
      }));
    }
    if (!this.input.tasks) await joinAskedToReceivers(deps.db, this.tasks, taskIds);
    const captureIds: string[] = [];
    if (!this.input.captures && this.task.pbiId !== null) for (const capture of this.captures) {
      captureIds.push(...await commitStep(deps.db, root, runId, "capture", capture, async tx => {
        const ids = await commitCaptures(tx, runId, this.task.pbiId!, this.task.id, [capture]);
        await addRunOutputs(tx, runId, ids);
        return ids;
      }));
    }

    const tasks = this.input.tasks ? [] : this.tasks;
    const writerIds = await this.commitWriters({ deps, task: this.task, runId, agentId: this.context.agent.id, tasks, taskIds, handoffs: handoffsOf(tasks, taskIds), repos: this.input.repos, result: this.result.latest, stoppedEarly });
    const resultOutput = await commitStep(deps.db, root, runId, "result", this.result.latest, async tx => {
      const output = await commitResult(tx, { runId, taskId: this.task.id, pbiId: this.task.pbiId, agent: this.context.agent.id }, this.result.latest);
      if (output) await addRunOutputs(tx, runId, [output]);
      return output;
    });

    await addRunOutputs(deps.db, runId, [...writerIds, ...taskIds, ...captureIds, ...(resultOutput ? [resultOutput] : [])]);
    await commitStep(deps.db, root, runId, "estimate", this.estimate.latest, async tx => {
      await commitEstimate(tx, { pbiId: this.task.pbiId, runId, agent: this.context.agent.id }, this.estimate.latest);
      return null;
    });

    return { taskIds, captureIds };
  }

  private use(): RunUse {
    const { agent } = this.context;

    return { turns: this.meter.toolCalls, maxTurns: agent.limits.maxTurns, spentUsd: this.session.spentUsd, budgetUsd: agent.budgets.perRunUsd };
  }

  /** A run its turns or time stopped: only its result, as a checkpoint. What it staged (tasks, captures, the writers'
   *  outputs, the estimate) isn't committed; the next run continues the conversation and makes those calls again. */
  async commitCheckpoint(runId: number): Promise<void> {
    const { deps } = this.context;
    const output = await commitResult(deps.db, { runId, taskId: this.task.id, pbiId: this.task.pbiId, agent: this.context.agent.id }, this.result.latest);

    await addRunOutputs(deps.db, runId, output ? [output] : []);
  }

  /** What the granted writers' outputs say about the task's end (see WriterSettlement). */
  settlements(): WriterSettlement[] {
    return this.writers.map((writer) => this.committedSettlements.has(writer.integration) ? this.committedSettlements.get(writer.integration)! : writer.settlement?.() ?? null).filter((settlement): settlement is WriterSettlement => settlement !== null);
  }

  /** What the granted writers add to the first message (a draft, a note to actualize). */
  async contextBlocks(): Promise<string[]> {
    const run = { runId: this.session.runId, repos: this.input.repos, session: this.session };
    const blocks = await Promise.all(this.writers.map((writer) => writer.contextBlocks?.(this.task, run) ?? []));

    return blocks.flat();
  }

  /** What the granted writers add to the instructions (a vault's rules). */
  async promptSections(): Promise<string[]> {
    const sections = await Promise.all(this.writers.map((writer) => writer.promptSections?.(this.task) ?? []));

    return sections.flat();
  }

  // One writer after the other: each may read what the one before wrote.
  private async commitWriters(target: WriterTarget): Promise<string[]> {
    const ids: string[] = [];

    for (const writer of this.writers) {
      const receipt = await commitStep(target.deps.db, this.session.commitRootRunId ?? target.runId, target.runId, writer.integration, writer.commitDraft?.() ?? null, async tx => {
        const outputs = await writer.commit({ ...target, deps: { ...target.deps, db: tx } });
        await addRunOutputs(tx, target.runId, outputs);
        return { outputs, settlement: writer.settlement?.() ?? null };
      });
      ids.push(...receipt.outputs);
      this.committedSettlements.set(writer.integration, receipt.settlement);
    }

    return ids;
  }

  // A Demonstration run gets its task-scoped browser boundary, with the writer's capture so screenshots are masked.
  private devHubTools(access: OutsideAccessContext): ToolDefinition<any>[] {
    const { deps, agent } = this.context;
    const tools = createDevHubTools(deps, agent, access);
    const guideWriter = this.writers.find((writer): writer is DemonstrationWriter => writer instanceof DemonstrationWriter);

    if (!guideWriter) {
      return tools;
    }

    return demonstrationTools(tools, this.task.body ?? "", guideWriter.capture, access.owner, deps.devHub?.client ?? null);
  }

  private readingGroups(): ToolGroup[] {
    const { deps, agent } = this.context;
    const access = outsideAccessContext(agent.id, this.session.runId, this.task);

    return [
      { source: EVERY_AGENT, tools: createAgentDocTools(deps, agent.id, runRef(this.session.runId), this.input.docsRoot) },
      { source: grantSource(agent, READ_REPOS_INTEGRATION), tools: this.input.repos.tools },
      { source: EVERY_AGENT, tools: [...this.catalogTools(), ...this.pbiTools(), createReadPbiTool(deps.db, deps.vaultRoot)] },
      { source: grantSource(agent, CONFLUENCE_INTEGRATION), tools: createConfluenceTools(deps, agent, access) },
      { source: grantSource(agent, READ_SQL_INTEGRATION), tools: createSqlTools(deps, agent, access) },
      { source: grantSource(agent, GOOGLE_DRIVE_INTEGRATION), tools: createGoogleDriveTools(deps, agent, access) },
      { source: grantSource(agent, GITHUB_READ_INTEGRATION), tools: createGitHubReadTools(deps, agent, access) },
      { source: grantSource(agent, GITHUB_WRITE_INTEGRATION), tools: createGitHubWriteTools(deps, agent, access, this.gitHub) },
      { source: READ_AZURE_SOURCE, tools: createAzureTools(deps, agent, access) },
      { source: grantSource(agent, DEVHUB_INTEGRATION), tools: this.devHubTools(access) },
      { source: grantSource(agent, SANDBOX_INTEGRATION), tools: createSandboxTools(deps, agent, access, this.input.repos) },
      { source: grantSource(agent, ADO_INTEGRATION), tools: createAdoTools(deps, agent, access) },
      { source: EVERY_AGENT, tools: createFetchDocumentTools(this.webDocuments, this.webPages) },
      { source: grantSource(agent, POWERLOOM_WEB_INTEGRATION), tools: [...createReadWebPageTools(agent, this.webPages), ...createWebSearchTools(deps, agent, access)] },
    ];
  }

  // The live test's command tools, minus the names the run already has.
  private liveTestGroups(existing: ToolDefinition<any>[]): { reads: ToolGroup; writes: ToolGroup } {
    const source = grantSource(this.context.agent, LIVE_TEST_INTEGRATION);
    const tools = this.liveTest ? this.liveTest.tools(new Set(existing.map((tool) => tool.name))) : { reads: [], writes: [] };

    return { reads: { source, tools: tools.reads }, writes: { source, tools: tools.writes } };
  }

  // The vault's catalog of enabled repos: what open_repo can add, and what refinement names in its repos.
  private catalogTools(): ToolDefinition<any>[] {
    return [listReposTool(this.context.deps.db, this.task.vault)];
  }

  private pbiTools(): ToolDefinition<any>[] {
    return this.task.pbiId === null ? [] : [createAttachmentTool(this.context.deps.db, this.task.pbiId)];
  }

  private writingGroups(log: ReadLog): ToolGroup[] {
    const { deps, agent } = this.context;
    const hasCreateTask = agent.canAssign.length > 0;

    const shared = [
      { source: EVERY_AGENT, tools: [createHandOffTool(agent.canAssign, this.tasks, this.guard, log, this.limits)] },
      { source: HAND_ON_SOURCE, tools: hasCreateTask ? [createTaskTool(agent.canAssign, this.tasks, this.guard, log, this.limits)] : [] },
      { source: EVERY_AGENT, tools: createWebDocumentTools(deps.db, this.webDocuments) },
      { source: EVERY_AGENT, tools: [createReportFailureTool(new DbFailureReportStore(deps.db), outsideAccessContext(agent.id, this.session.runId, this.task), this.failureReports)] },
      { source: EVERY_AGENT, tools: deps.captureRules && this.task.pbiId !== null ? [createVaultCaptureTool(this.captures, deps.captureRules)] : [] },
      { source: grantSource(agent, ESTIMATE_INTEGRATION), tools: createEstimateTools(this.estimate) },
    ];
    // A writer's tool with a shared tool's name gives way to it.
    const own = this.writers.map((writer) => ({ source: grantSource(agent, writer.integration), tools: ownTools(writer.tools(log, { estimate: this.estimate, tasks: this.tasks }), toolsOf(shared)) }));

    return [...shared, ...own, { source: EVERY_AGENT, tools: [createResultTool(this.result, log)] }];
  }
}

// What the run's hand_off calls became: each hand-off's intent and the item written for it.
function handoffsOf(tasks: CreatedTask[], taskIds: string[]): RunHandoff[] {
  return tasks.flatMap((task, index) => (task.handoff && taskIds[index] ? [{ intent: task.handoff.intent, toItemId: taskIds[index] }] : []));
}

// The output tools the agent's Config grants, by integration key.
export function grantedWriters(context: TaskContext): RunWriter[] {
  const integrations = context.agent.capabilities.integrations ?? {};

  return [
    ...(integrations[RESEARCH_RESULT_INTEGRATION] === true ? [new ResearchResultWriter()] : []),
    ...(integrations[WRITE_NOTES_INTEGRATION] === true ? [new TechWriterWriter(context.deps)] : []),
    ...(integrations[VAULT_REVIEW_INTEGRATION] === true ? [new VaultReviewWriter(context)] : []),
    ...(integrations[WRITE_DESIGN_INTEGRATION] === true ? [new DesignWriter(context)] : []),
    ...(integrations[WRITE_REFINEMENT_INTEGRATION] === true ? [new RefinementWriter(context)] : []),
    ...(integrations[CODE_REVIEW_INTEGRATION] === true ? [new ReviewWriter(context)] : []),
    ...(integrations[BETTER_REVIEW_INTEGRATION] === true ? [new BetterReviewWriter(context)] : []),
    ...(integrations[AUTOTEST_INTEGRATION] === true ? [new AutotestWriter(context)] : []),
    ...(integrations[DEMONSTRATION_INTEGRATION] === true ? [new DemonstrationWriter(context)] : []),
  ];
}

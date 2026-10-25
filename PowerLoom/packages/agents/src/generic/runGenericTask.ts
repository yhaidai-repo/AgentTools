import { localItem, type PowerLoomDb } from "@powerloom/db";
import { AgentRunSession } from "../AgentRunSession";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { RepoSource } from "../models/RepoSource";
import type { TaskContext } from "../models/TaskContext";
import type { OpenReposOptions } from "../models/OpenReposOptions";
import type { RunWriter } from "../toolset/models/RunWriter";
import { projectRepoName } from "../docsRepos";
import { environmentPromptSection } from "../environment/vaultEnvironment";
import { pbiRepoSources } from "../repos/agentRepos";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { reposBlock } from "../repos/reposBlock";
import { acceptanceCriteriaBlock } from "../tasks/userTasks";
import { noteVault } from "../techWriter/taskVault";
import { AgentToolset, grantedWriters } from "../toolset/AgentToolset";
import { recordToolOffer } from "../toolset/recordToolOffer";
import { toolsPromptSection } from "../toolset/toolsPromptSection";
import type { GenericRun } from "./models/GenericRun";
import { loadPreviousResult, previousResultBlock } from "./previousResult";
import { settleTask } from "./settleTask";

type ItemRow = typeof localItem.$inferSelect;


// One task of an agent without code of its own (user decision 2026-10-22): its prompt, the framework and its skills as
// instructions; the task, the PBI's context (AgentRunSession adds it) and the task's latest result (not on Start over)
// as the first message; whatever its Config grants as tools; write_result as the run's required output. Once everything
// is committed the task is settled in one place (settleTask): done, waiting for what it handed on, or blocked, never
// done while unfinished.
export async function runGenericTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps, agent } = context;
  const info: AgentRunInfo = {
    stage: agent.id,
    pbiId: task.pbiId,
    itemId: task.id,
    labels: { agent: agent.id, item: task.id },
    model: agent.model,
    promptVersion: context.prompt.version,
  };
  const run: GenericRun = { repos: noRepos(), toolset: null, writers: [] };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, run));

    // A run stopped by its budget keeps the result it wrote (status partial), so the work so far isn't lost.
    const committed: { createdIds: string[] | null } = { createdIds: null };
    const final = await session.finish(ran, async () => { committed.createdIds = (await run.toolset?.commit(session.runId, ran.outcome === "budget-exceeded"))?.taskIds ?? []; }, run.toolset?.result.isWritten ?? false);

    // Settled once everything is committed, never by a writer; a failed commit is ended by endTask as a failure.
    if (committed.createdIds && run.toolset && (final.outcome === "success" || final.outcome === "budget-exceeded")) {
      await settleTask(deps.db, task, final.runId, { outcome: final.outcome, result: run.toolset.result.latest, createdIds: committed.createdIds, writers: run.toolset.settlements() });
    }

    return final;
  } finally {
    await cleanUpWriters(run);
    closeRepos(deps, run.repos);
  }
}

// Each writer removes what it left behind (a checkout); one failing doesn't stop the others.
async function cleanUpWriters(run: GenericRun): Promise<void> {
  for (const writer of run.writers) {
    try {
      await writer.cleanUp?.();
    } catch (error) {
      console.error(`cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// How the repos open: the first writer that says so decides (a PR checkout as the tools' root).
function repoOptions(task: ItemRow, runId: number, writers: RunWriter[]): OpenReposOptions {
  return Object.assign({}, ...writers.map((writer) => writer.repoOptions?.(task, runId) ?? {}));
}

async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, run: GenericRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;

  const writers = grantedWriters(context);

  run.writers = writers;
  await session.phase("context", { task: task.id, vault: task.vault });
  run.repos = await openRepos(context, session, await repoSources(context, task, writers), { vault: task.vault, ...repoOptions(task, session.runId, writers) });

  const toolset = await AgentToolset.open(context, session, task, { repos: run.repos, docsRoot: taskVaultRoot(deps, task), writers, depth: chainDepth(task) });
  const firstMessage = await buildFirstMessage(deps.db, task, run, await toolset.contextBlocks(), toolset.webDocumentsBlock());
  const tools = toolset.tools(firstMessage);

  run.toolset = toolset;
  await recordToolOffer(deps.db, task.vault, agent.id, toolset.offered);
  await session.phase("first-message", { chars: firstMessage.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, await environmentPromptSection(deps.docsRoot, deps.docsVaultName, agent.id), ...(await toolset.promptSections()), skills.promptSection, toolsPromptSection(tools)].filter(Boolean).join("\n\n"),
    firstMessage,
    tools,
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    observe: (event) => toolset.observe(event),
    hasRequiredOutput: () => toolset.result.isWritten,
  };
}

// A refinement starts a PBI's chain: the tasks it creates are depth 1. Every other task carries its depth.
function chainDepth(task: ItemRow): number | undefined {
  return task.kind === "refinement" ? 0 : undefined;
}

// A task that names a vault (a docs task on a note) works in that vault; the docs tools read it and its usage log.
function taskVaultRoot(deps: TaskContext["deps"], task: ItemRow): string | undefined {
  const vault = (task.data as { vault?: string } | null)?.vault;

  return vault ? noteVault(deps, vault).root : undefined;
}

// The PBI's repos, or the ones a task without a PBI names (the Tasks page's repo choice); plus the repo of the docs
// project a task names (its index note's `repo:`), plus what the granted writers need.
async function repoSources(context: TaskContext, task: ItemRow, writers: RunWriter[]): Promise<RepoSource[]> {
  const fromWriters = (await Promise.all(writers.map((writer) => writer.repoSources?.(task) ?? []))).flat();
  const data = (task.data ?? {}) as { repos?: string[]; project?: string };
  const projectRepo = data.project ? await projectRepoName(taskVaultRoot(context.deps, task) ?? context.deps.docsRoot, data.project) : null;
  const fromProject: RepoSource[] = projectRepo ? [{ vault: task.vault, names: [projectRepo] }] : [];
  const own: RepoSource[] = task.pbiId !== null ? await pbiRepoSources(context.deps.db, task.pbiId) : [{ vault: task.vault, names: data.repos ?? [] }];

  return [...fromProject, ...own, ...fromWriters];
}

async function buildFirstMessage(db: PowerLoomDb, task: ItemRow, run: GenericRun, writerBlocks: string[], webDocuments: string): Promise<string> {
  return [
    taskBlock(task),
    acceptanceCriteriaBlock(task),
    ...writerBlocks,
    // The task row was read before the run began, so it still holds the Start over the run clears.
    previousResultBlock(await loadPreviousResult(db, task.id), task.startOver),
    webDocuments,
    reposBlock(run.repos),
    "Work on the task, then call write_result once with the result.",
  ].filter(Boolean).join("\n\n");
}

function taskBlock(task: ItemRow): string {
  const data = (task.data ?? {}) as { why?: string; doneWhen?: string };
  const lines = [
    `Id: ${task.id}`,
    `Kind: ${task.kind}`,
    `Title: ${task.title}`,
    ...(data.why ? [`Why: ${data.why}`] : []),
    ...(data.doneWhen ? [`Done when: ${data.doneWhen}`] : []),
  ];

  return ["<task>", ...lines, "", task.body ?? "", "</task>"].join("\n");
}

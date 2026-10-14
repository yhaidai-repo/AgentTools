import { localItem } from "@powerloom/db";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AgentRunSession } from "../AgentRunSession";
import type { AgentDeps } from "../models/AgentDeps";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { RepoAccess } from "../models/RepoAccess";
import type { RepoSource } from "../models/RepoSource";
import type { TaskContext } from "../models/TaskContext";
import { pbiRepoSources } from "../repos/agentRepos";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { reposBlock } from "../repos/reposBlock";
import { acceptanceCriteriaBlock, isUserTask } from "../tasks/userTasks";
import { AgentToolset } from "../toolset/AgentToolset";
import { toolsPromptSection } from "../toolset/toolsPromptSection";
import { commitActualize, commitTechWriter } from "./commitTechWriter";
import { isDelegating, waitForCreatedTasks } from "./delegation";
import { dependenciesBlock } from "./dependenciesBlock";
import { relinkDraft, requireNoDraftLinks } from "./draftLinks";
import type { ActualizeTaskData } from "./models/ActualizeTaskData";
import type { DraftTaskData } from "./models/DraftTaskData";
import type { TaskVault } from "./models/TaskVault";
import type { TechWriterDraft } from "./models/TechWriterDraft";
import type { TechWriterRun } from "./models/TechWriterRun";
import { projectRepoName } from "../docsRepos";
import { createTechWriterTools } from "./techWriterTools";

type ItemRow = typeof localItem.$inferSelect;

const AGENT = "tech-writer";

// One tech-writer task (WT-…), one run: a draft moved into the docs vault (user decision 2026-10-02), or an existing note
// brought up to date for the vault review (actualize, user decision 2026-10-03). The repos it took from the cache are
// released whatever happens.
export async function runTechWriterTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps } = context;
  const vault = taskVault(deps, task);
  const info: AgentRunInfo = {
    stage: "tech-writer",
    pbiId: task.pbiId,
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const run: TechWriterRun = { repos: noRepos(), toolset: null, draft: { edits: [], findings: [], home: null } };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, vault, run));

    return await session.finish(ran, () => commit(context, vault, task, session.runId, run));
  } finally {
    closeRepos(deps, run.repos);
  }
}

function isActualize(task: ItemRow): boolean {
  return (task.data as { mode?: string } | null)?.mode === "actualize";
}

function taskVault(deps: AgentDeps, task: ItemRow): TaskVault {
  return isActualize(task) ? actualizeVault(deps, task.data as ActualizeTaskData) : draftVault(deps);
}

// Drafts live in the task's vault (the run's; mounted writable, and VaultWriter keeps every path inside it).
function draftVault(deps: AgentDeps): TaskVault {
  if (!deps.docsVault) {
    throw new Error(`${deps.docsVaultName} isn't writable for the agent-runner (its mount)`);
  }

  return { name: deps.docsVaultName, root: deps.docsRoot, writer: deps.docsVault, isDocsVault: true };
}

// The note's own vault, read through the docs root when it is the docs vault, so reads still reach its usage log.
function actualizeVault(deps: AgentDeps, data: ActualizeTaskData): TaskVault {
  if (!deps.vaults) {
    throw new Error("the vaults root isn't mounted for the agent-runner (VAULTS_DIR)");
  }

  const isDocsVault = data.vault === deps.docsVaultName;

  return { name: data.vault, root: isDocsVault ? deps.docsRoot : join(deps.vaults.root, data.vault), writer: deps.vaults.writer(data.vault), isDocsVault };
}

// Handed work on: the tasks are written and this task waits for them; notes written in the same run are not kept.
async function commit(context: TaskContext, vault: TaskVault, task: ItemRow, runId: number, run: TechWriterRun): Promise<void> {
  const created = await run.toolset?.commit(runId);

  if (created && created.taskIds.length > 0) {
    await waitForCreatedTasks(context.deps.db, task, runId, created.taskIds);

    return;
  }

  await commitNotes(context, vault, task, runId, run.draft);
}

async function commitNotes(context: TaskContext, vault: TaskVault, task: ItemRow, runId: number, draft: TechWriterDraft): Promise<void> {
  if (isActualize(task)) {
    await commitActualize(context.deps.db, vault, task, runId, draft);

    return;
  }

  const draftName = (task.data as DraftTaskData).draft;
  const edits = await relinkDraft(vault.root, draftName, draft);

  await requireNoDraftLinks(vault.root, draftName, edits);
  await commitTechWriter(context.deps.db, vault, task, runId, { ...draft, edits });
}

// The repository first (user decision 2026-10-02), then the task's note and the vault rules; each step is a traced phase.
async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, vault: TaskVault, run: TechWriterRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;
  const data = task.data as DraftTaskData | ActualizeTaskData;

  await session.phase("context", { task: task.id, vault: vault.name, path: data.path, project: data.project, mode: isActualize(task) ? "actualize" : "draft" });
  run.repos = await openRepos(context, session, await taskRepoSources(context, task, vault, data.project), { vault: task.vault });

  const toolset = await AgentToolset.open(context, session, task, { repos: run.repos, docsRoot: vault.root });
  const taskMessage = isActualize(task) ? await actualizeMessage(vault, task, data as ActualizeTaskData, run.repos) : await draftMessage(vault, task, data as DraftTaskData, run.repos);
  const firstMessage = [taskMessage, await dependenciesBlock(deps.db, task), toolset.webDocumentsBlock()].filter(Boolean).join("\n\n");
  const vaultRules = await readFile(join(vault.root, "AGENTS.md"), "utf8");
  const tools = [...toolset.tools(firstMessage), ...createTechWriterTools(deps, run.draft)];

  run.toolset = toolset;
  await session.phase("first-message", { chars: firstMessage.length, vaultRulesChars: vaultRules.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, `## Vault rules (the ${vault.name} vault's AGENTS.md)\n\n${vaultRules}`, skills.promptSection, toolsPromptSection(tools)].filter(Boolean).join("\n\n"),
    firstMessage,
    tools,
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    observe: (event) => toolset.observe(event),
    // A draft has to leave draft/, and an actualized note has to be rewritten, unless the run handed work on and waits
    // for it: a run that does neither didn't do the job.
    hasRequiredOutput: () => isDelegating(run) || (isActualize(task) ? run.draft.edits.some((edit) => edit.path === data.path) : run.draft.edits.length > 0),
  };
}

// The repos attached to the task: the project's repo from its index note, plus the PBI's repos for a draft PowerLoom
// captured.
async function taskRepoSources(context: TaskContext, task: ItemRow, vault: TaskVault, project: string): Promise<RepoSource[]> {
  const projectRepo = await projectRepoName(vault.root, project);
  const fromProject = projectRepo ? [{ vault: vault.name, names: [projectRepo] }] : [];
  const fromPbi = task.pbiId === null ? [] : await pbiRepoSources(context.deps.db, task.pbiId);

  return [...fromProject, ...fromPbi];
}

async function draftMessage(vault: TaskVault, task: ItemRow, data: DraftTaskData, repos: RepoAccess): Promise<string> {
  const draftText = await readFile(join(vault.root, data.path), "utf8");

  return [
    "Move this draft into the docs vault: verify it, merge it into its target, then the draft is deleted.",
    `<task>\nId: ${task.id}\nDraft: ${data.path}\nProject: ${data.project}\nTarget: ${data.target}\nSource: ${data.source}${task.pbiId ? `\nPBI: ${task.pbiId}` : ""}\n</task>`,
    `<draft>\n${draftText.trim()}\n</draft>`,
    await projectIndexBlock(vault, data.project),
    reposBlock(repos),
  ].join("\n\n");
}

async function actualizeMessage(vault: TaskVault, task: ItemRow, data: ActualizeTaskData, repos: RepoAccess): Promise<string> {
  const noteText = await readFile(join(vault.root, data.path), "utf8");
  const suspects = data.suspectFacts.map((fact) => `- ${fact}`).join("\n") || "- (none named)";
  const userAsked = isUserTask(task);
  const why = userAsked ? "the user asked for it" : "the vault review found it outdated";

  return [
    `Actualize this note: ${why}. Re-verify it against the code and rewrite it in place.`,
    `<task>\nId: ${task.id}\nMode: actualize\nVault: ${vault.name}\nNote: ${data.path}\nProject: ${data.project}\nAsked by: ${userAsked ? "the user" : data.reviewTask}\n</task>`,
    `<reasons>\n${data.reasons}\n</reasons>`,
    acceptanceCriteriaBlock(task),
    `<suspect-facts>\n${suspects}\n</suspect-facts>`,
    `<note>\n${noteText.trim()}\n</note>`,
    await projectIndexBlock(vault, data.project),
    reposBlock(repos),
  ].filter(Boolean).join("\n\n");
}

async function projectIndexBlock(vault: TaskVault, project: string): Promise<string> {
  const index = await readFile(join(vault.root, project, `${project}-index.md`), "utf8").catch(() => "(no project index)");

  return `<project-index>\n${index.trim()}\n</project-index>`;
}

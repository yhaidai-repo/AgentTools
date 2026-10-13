import { isRecommendableSkill, requirePbiId } from "@powerloom/core";
import { localItem, workItem } from "@powerloom/db";
import { createListSkillsTool, listSkills } from "@agenttools/runtime";
import { eq } from "drizzle-orm";
import { AgentRunSession } from "../AgentRunSession";
import { DuplicateGuard } from "../DuplicateGuard";
import { readingTools, taskLimits } from "../betterAgents/toolset";
import { withBudgetNotes } from "../budget/budgetNotes";
import { documentedRepos } from "../docsRepos";
import { ReadLog } from "../evidence/ReadLog";
import { recordReads } from "../evidence/recordReads";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { RepoAccess } from "../models/RepoAccess";
import type { TaskContext } from "../models/TaskContext";
import { buildPbiMessage } from "../refinement/pbiMessage";
import { listReposTool } from "../refinement/refinementTools";
import { withPagesRead } from "../relevantPages";
import { pbiRepoSources } from "../repos/agentRepos";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { reposBlock } from "../repos/reposBlock";
import { confluencePagesReadInRun, docsReadInRun, skillsTrace } from "../stage";
import { createTaskTool } from "../taskCreation/createTaskTool";
import { userRequestBlock } from "../tasks/userTasks";
import { createVaultCaptureTool } from "../vaultCapture";
import { commitBetterRefinement } from "./commitBetterRefinement";
import type { BetterRefinementDraft } from "./models/BetterRefinementDraft";
import { REFINEMENT_TOOL, createRefinementTool } from "./refinementTool";

type ItemRow = typeof localItem.$inferSelect;
type WorkItemRow = typeof workItem.$inferSelect;
type Run = { repos: RepoAccess; readLog: ReadLog | null; draft: BetterRefinementDraft };

const AGENT = "better-refinement";
// Refinement starts a PBI's chain: the tasks it creates are depth 1.
const DEPTH = 0;

// One Better Refinement task (RT-…): one run on its PBI; the refinement, the tasks it created and its drafts are committed
// on success, and also after a budget stop when a refinement was saved.
export async function runBetterRefinementTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps } = context;
  const pbiId = requirePbiId(task);
  const [row] = await deps.db.select().from(workItem).where(eq(workItem.adoId, pbiId));
  const info: AgentRunInfo = {
    stage: "better-refinement",
    pbiId,
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const run: Run = { repos: noRepos(), readLog: null, draft: { refinement: null, tasks: [], captures: [], pages: [] } };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, row, run));
    const commit = async () => {
      const pages = withPagesRead(run.draft.pages, await confluencePagesReadInRun(deps, session.runId), "Read by Better Refinement while refining.");
      const extra = { docsRead: await docsReadInRun(deps, session.runId), documented: await documentedRepos(deps.docsRoot), docsVault: deps.docsVaultName };

      await commitBetterRefinement(deps.db, { id: task.id, pbiId }, session.runId, { ...run.draft, refinement: run.draft.refinement!, pages }, extra);
    };

    return await session.finish(ran, commit, run.draft.refinement !== null);
  } finally {
    closeRepos(deps, run.repos);
  }
}

async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, row: WorkItemRow, run: Run): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;

  await session.phase("context", { pbi: row.adoId, note: row.vaultPath, skills: skillsTrace(skills) });
  run.repos = await openRepos(context, session, await pbiRepoSources(deps.db, row.adoId));

  const firstMessage = [await buildPbiMessage(deps.db, deps.vaultRoot, row), userRequestBlock(task), reposBlock(run.repos)].filter(Boolean).join("\n\n");
  const recommendable = (await listSkills(deps.skillFolders)).skills.map((skill) => skill.name).filter(isRecommendableSkill);
  const guard = await DuplicateGuard.load(deps.db, row.adoId);
  const limits = await taskLimits(context, row.adoId, DEPTH);

  run.readLog = new ReadLog(firstMessage);
  await session.phase("first-message", { chars: firstMessage.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, skills.promptSection].filter(Boolean).join("\n\n"),
    firstMessage,
    tools: withBudgetNotes([
      ...recordReads([...readingTools(context, session, task, run.repos), listReposTool(deps.db, deps.docsVaultName)], run.readLog),
      ...skills.tools,
      createListSkillsTool(deps.skillFolders, isRecommendableSkill),
      createTaskTool(agent.canAssign, run.draft.tasks, guard, run.readLog, limits),
      createRefinementTool(run.draft, run.readLog, recommendable),
      ...(deps.captureRules ? [createVaultCaptureTool(run.draft.captures, deps.captureRules)] : []),
    ], () => session.spentUsd, agent.budgets.perRunUsd, REFINEMENT_TOOL),
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    observe: (event) => run.readLog?.observe(event),
    hasRequiredOutput: () => run.draft.refinement !== null,
  };
}

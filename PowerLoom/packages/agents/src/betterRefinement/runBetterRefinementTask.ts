import { isRecommendableSkill, requirePbiId } from "@powerloom/core";
import { localItem, workItem } from "@powerloom/db";
import { createListSkillsTool, listSkills } from "@agenttools/runtime";
import { eq } from "drizzle-orm";
import { AgentRunSession } from "../AgentRunSession";
import { withBudgetNotes } from "../budget/budgetNotes";
import { documentedRepos } from "../docsRepos";
import { ESTIMATE_TOOL } from "../estimate/estimateTool";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { RepoAccess } from "../models/RepoAccess";
import type { TaskContext } from "../models/TaskContext";
import { hasRefinementOutput } from "../refinement/hasRefinementOutput";
import { buildPbiMessage } from "../refinement/pbiMessage";
import { withPagesRead } from "../relevantPages";
import { pbiRepoSources } from "../repos/agentRepos";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { reposBlock } from "../repos/reposBlock";
import { confluencePagesReadInRun, docsReadInRun, skillsTrace } from "../stage";
import { userRequestBlock } from "../tasks/userTasks";
import { AgentToolset } from "../toolset/AgentToolset";
import { toolsPromptSection } from "../toolset/toolsPromptSection";
import { commitBetterRefinement } from "./commitBetterRefinement";
import type { BetterRefinementDraft } from "./models/BetterRefinementDraft";
import { REFINEMENT_TOOL, createRefinementTool } from "./refinementTool";

type ItemRow = typeof localItem.$inferSelect;
type WorkItemRow = typeof workItem.$inferSelect;
type Run = { repos: RepoAccess; toolset: AgentToolset | null; draft: BetterRefinementDraft };

const AGENT = "better-refinement";
// Refinement starts a PBI's chain: the tasks it creates are depth 1.
const DEPTH = 0;

// One Better Refinement task (RT-…): one run on its PBI; the refinement, the tasks it created, its drafts and its estimate
// are committed on success, and also after a budget stop when a refinement was saved.
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
  const run: Run = { repos: noRepos(), toolset: null, draft: { refinement: null, tasks: [], captures: [], pages: [] } };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, row, run));
    const commit = async () => {
      const pages = withPagesRead(run.draft.pages, await confluencePagesReadInRun(deps, session.runId), "Read by Better Refinement while refining.");
      const extra = { docsRead: await docsReadInRun(deps, session.runId), documented: await documentedRepos(deps.docsRoot), docsVault: deps.docsVaultName };

      await commitBetterRefinement(deps.db, { id: task.id, pbiId, vault: task.vault }, session.runId, { ...run.draft, refinement: run.draft.refinement!, pages }, extra);
      await run.toolset?.commit(session.runId);
    };

    return await session.finish(ran, commit, run.draft.refinement !== null);
  } finally {
    closeRepos(deps, run.repos);
  }
}

async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, row: WorkItemRow, run: Run): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;

  await session.phase("context", { pbi: row.adoId, note: row.vaultPath, skills: skillsTrace(skills) });
  run.repos = await openRepos(context, session, await pbiRepoSources(deps.db, row.adoId), { vault: task.vault });

  const toolset = await AgentToolset.open(context, session, task, { repos: run.repos, depth: DEPTH, createTask: true, tasks: run.draft.tasks, captures: run.draft.captures });
  const firstMessage = [await buildPbiMessage(deps.db, deps.vaultRoot, row), userRequestBlock(task), toolset.webDocumentsBlock(), reposBlock(run.repos)].filter(Boolean).join("\n\n");
  const recommendable = (await listSkills(deps.skillFolders)).skills.map((skill) => skill.name).filter(isRecommendableSkill);
  const tools = withBudgetNotes([
    ...toolset.tools(firstMessage),
    createListSkillsTool(deps.skillFolders, isRecommendableSkill),
    createRefinementTool(run.draft, toolset.readLog, recommendable),
  ], () => session.spentUsd, agent.budgets.perRunUsd, resultTools(toolset));

  run.toolset = toolset;
  await session.phase("first-message", { chars: firstMessage.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, skills.promptSection, toolsPromptSection(tools)].filter(Boolean).join("\n\n"),
    firstMessage,
    tools,
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    observe: (event) => toolset.observe(event),
    hasRequiredOutput: () => hasRefinementOutput(run.draft.refinement, toolset.estimate),
  };
}

// Refinement must estimate when its Config grants it (user decision 2026-10-18), so the budget note asks for both.
function resultTools(toolset: AgentToolset): string {
  return toolset.estimate.isOffered ? `${REFINEMENT_TOOL} and ${ESTIMATE_TOOL}` : REFINEMENT_TOOL;
}

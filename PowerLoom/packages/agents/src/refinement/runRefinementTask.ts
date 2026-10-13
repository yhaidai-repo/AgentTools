import { localItem, workItem } from "@powerloom/db";
import { isRecommendableSkill, requirePbiId } from "@powerloom/core";
import { createListSkillsTool, listSkills } from "@agenttools/runtime";
import { eq } from "drizzle-orm";
import { AgentRunSession } from "../AgentRunSession";
import { DuplicateGuard } from "../DuplicateGuard";
import { createAttachmentTool } from "../attachmentTools";
import { createConfluenceTools } from "../confluenceTools";
import { documentedRepos } from "../docsRepos";
import { createVaultCaptureTool } from "../vaultCapture";
import { createWebResearchTool } from "../webResearch";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import { pbiRepoSources } from "../repos/agentRepos";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { reposBlock } from "../repos/reposBlock";
import { withPagesRead } from "../relevantPages";
import { createAzureTools } from "../azureTools";
import { createLocalStackTools } from "../localStackTools";
import { createTestCaseTools } from "../testCases/testCaseTools";
import { createSqlTools } from "../sqlTools";
import { confluencePagesReadInRun, createAgentDocTools, docsReadInRun, outsideAccessContext, skillsTrace } from "../stage";
import { commitRefinement } from "./commitRefinement";
import type { RefinementDraft } from "./models/RefinementDraft";
import type { RefinementRun } from "./models/RefinementRun";
import { userRequestBlock } from "../tasks/userTasks";
import { buildPbiMessage } from "./pbiMessage";
import { createRefinementTools } from "./refinementTools";

type ItemRow = typeof localItem.$inferSelect;
type WorkItemRow = typeof workItem.$inferSelect;

const AGENT = "refinement";

// One refinement task (RT-…): one run on its PBI; on success the refinement, research tasks and questions are committed.
export async function runRefinementTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps } = context;
  const pbiId = requirePbiId(task);
  const [row] = await deps.db.select().from(workItem).where(eq(workItem.adoId, pbiId));
  const info: AgentRunInfo = {
    stage: "refinement",
    pbiId,
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const draft: RefinementDraft = { refinement: null, researchTasks: [], questions: [], webResearch: [], captures: [], pages: [] };
  const run: RefinementRun = { repos: noRepos() };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, row, draft, run));
    const commit = async () => {
      const pages = withPagesRead(draft.pages, await confluencePagesReadInRun(deps, session.runId), "Read by refinement while refining.");

      await commitRefinement(deps.db, pbiId, session.runId, { ...draft, refinement: draft.refinement!, pages }, await docsReadInRun(deps, session.runId), await documentedRepos(deps.docsRoot));
    };

    return await session.finish(ran, commit);
  } finally {
    closeRepos(deps, run.repos);
  }
}

// With Read repositories on, refinement also reads the repos already attached to the PBI (documented or confirmed).
async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, row: WorkItemRow, draft: RefinementDraft, run: RefinementRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;

  await session.phase("context", { pbi: row.adoId, note: row.vaultPath, skills: skillsTrace(skills) });
  run.repos = await openRepos(context, session, await pbiRepoSources(deps.db, row.adoId));

  const pbiMessage = await buildPbiMessage(deps.db, deps.vaultRoot, row);
  const firstMessage = [pbiMessage, userRequestBlock(task), reposBlock(run.repos)].filter(Boolean).join("\n\n");
  const recommendable = (await listSkills(deps.skillFolders)).skills.map((skill) => skill.name).filter(isRecommendableSkill);
  const guard = await DuplicateGuard.load(deps.db, row.adoId);

  await session.phase("first-message", { chars: firstMessage.length });

  const access = outsideAccessContext(context.agent.id, session.runId, task);

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, skills.promptSection].filter(Boolean).join("\n\n"),
    firstMessage,
    tools: [
      ...createAgentDocTools(deps, context.agent.id, session.runId),
      ...run.repos.tools,
      ...skills.tools,
      createListSkillsTool(deps.skillFolders, isRecommendableSkill),
      createAttachmentTool(deps.db, row.adoId),
      ...createRefinementTools(deps.db, deps.docsVaultName, draft, pbiMessage, recommendable, guard),
      ...(agent.capabilities.webAccess ? [] : [createWebResearchTool(draft.webResearch, guard)]),
      ...createConfluenceTools(deps, agent, access),
      ...createSqlTools(deps, agent, access),
      ...createAzureTools(deps, agent, access),
      ...createLocalStackTools(deps, agent, access),
      ...createTestCaseTools(deps, agent, access),
      ...(deps.captureRules ? [createVaultCaptureTool(draft.captures, deps.captureRules)] : []),
    ],
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    hasRequiredOutput: () => draft.refinement !== null,
  };
}

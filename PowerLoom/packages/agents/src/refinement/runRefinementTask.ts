import { localItem, workItem } from "@powerloom/db";
import { isRecommendableSkill, requirePbiId } from "@powerloom/core";
import { createListSkillsTool, listSkills } from "@agenttools/runtime";
import { eq } from "drizzle-orm";
import { AgentRunSession } from "../AgentRunSession";
import { DuplicateGuard } from "../DuplicateGuard";
import { documentedRepos } from "../docsRepos";
import { createWebResearchTool } from "../webResearch";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import { pbiRepoSources } from "../repos/agentRepos";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { reposBlock } from "../repos/reposBlock";
import { withPagesRead } from "../relevantPages";
import { confluencePagesReadInRun, docsReadInRun, skillsTrace } from "../stage";
import { AgentToolset } from "../toolset/AgentToolset";
import { toolsPromptSection } from "../toolset/toolsPromptSection";
import { commitRefinement } from "./commitRefinement";
import type { RefinementDraft } from "./models/RefinementDraft";
import type { RefinementRun } from "./models/RefinementRun";
import { userRequestBlock } from "../tasks/userTasks";
import { buildPbiMessage } from "./pbiMessage";
import { createRefinementTools } from "./refinementTools";

type ItemRow = typeof localItem.$inferSelect;
type WorkItemRow = typeof workItem.$inferSelect;

const AGENT = "refinement";
// Refinement starts a PBI's chain: the tasks it creates are depth 1.
const DEPTH = 0;

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
  const run: RefinementRun = { repos: noRepos(), toolset: null };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, row, draft, run));
    const commit = async () => {
      const pages = withPagesRead(draft.pages, await confluencePagesReadInRun(deps, session.runId), "Read by refinement while refining.");

      await commitRefinement(deps.db, { id: task.id, pbiId }, session.runId, { ...draft, refinement: draft.refinement!, pages }, await docsReadInRun(deps, session.runId), await documentedRepos(deps.docsRoot));
      await run.toolset?.commit(session.runId);
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
  run.repos = await openRepos(context, session, await pbiRepoSources(deps.db, row.adoId), { vault: task.vault });

  const guard = await DuplicateGuard.load(deps.db, row.adoId);
  const toolset = await AgentToolset.open(context, session, task, { repos: run.repos, depth: DEPTH, guard, captures: draft.captures });
  const pbiMessage = await buildPbiMessage(deps.db, deps.vaultRoot, row);
  const firstMessage = [pbiMessage, userRequestBlock(task), toolset.webDocumentsBlock(), reposBlock(run.repos)].filter(Boolean).join("\n\n");
  const recommendable = (await listSkills(deps.skillFolders)).skills.map((skill) => skill.name).filter(isRecommendableSkill);
  const tools = [
    ...toolset.tools(firstMessage),
    createListSkillsTool(deps.skillFolders, isRecommendableSkill),
    ...createRefinementTools(draft, pbiMessage, recommendable, guard),
    ...(agent.capabilities.webAccess ? [] : [createWebResearchTool(draft.webResearch, guard)]),
  ];

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
    hasRequiredOutput: () => draft.refinement !== null,
  };
}

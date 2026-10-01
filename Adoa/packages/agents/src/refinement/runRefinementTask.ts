import { localItem, workItem } from "@adoa/db";
import { isRecommendableSkill, requirePbiId } from "@adoa/core";
import { createDocTools, createListSkillsTool, listSkills } from "@agenttools/runtime";
import { eq } from "drizzle-orm";
import { AgentRunSession } from "../AgentRunSession";
import { DuplicateGuard } from "../DuplicateGuard";
import { createAttachmentTool } from "../attachmentTools";
import { createWebResearchTool } from "../webResearch";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import { docsReadInRun, skillsTrace } from "../stage";
import { commitRefinement } from "./commitRefinement";
import type { RefinementDraft } from "./models/RefinementDraft";
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
  const draft: RefinementDraft = { refinement: null, researchTasks: [], questions: [], webResearch: [] };
  const session = await AgentRunSession.begin(deps, info);
  const ran = await session.execute(info, () => prepare(context, session, row, draft));
  const commit = async () => {
    await commitRefinement(deps.db, pbiId, session.runId, { ...draft, refinement: draft.refinement! }, await docsReadInRun(deps, session.runId));
  };

  return session.finish(ran, commit);
}

async function prepare(context: TaskContext, session: AgentRunSession, row: WorkItemRow, draft: RefinementDraft): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;

  await session.phase("context", { pbi: row.adoId, note: row.vaultPath, skills: skillsTrace(skills) });

  const pbiMessage = await buildPbiMessage(deps.db, deps.vaultRoot, row);
  const recommendable = (await listSkills(deps.skillFolders)).skills.map((skill) => skill.name).filter(isRecommendableSkill);
  const guard = await DuplicateGuard.load(deps.db, row.adoId);

  await session.phase("first-message", { chars: pbiMessage.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, skills.promptSection].filter(Boolean).join("\n\n"),
    firstMessage: pbiMessage,
    tools: [
      ...createDocTools({ root: deps.docsRoot, exclude: deps.docsExclude }),
      ...skills.tools,
      createListSkillsTool(deps.skillFolders, isRecommendableSkill),
      createAttachmentTool(deps.db, row.adoId),
      ...createRefinementTools(deps.db, draft, pbiMessage, recommendable, guard),
      ...(agent.capabilities.webAccess ? [] : [createWebResearchTool(draft.webResearch, guard)]),
    ],
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    hasRequiredOutput: () => draft.refinement !== null,
  };
}

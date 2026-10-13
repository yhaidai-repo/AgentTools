import { requirePbiId } from "@powerloom/core";
import { localItem } from "@powerloom/db";
import { AgentRunSession } from "../AgentRunSession";
import { DuplicateGuard } from "../DuplicateGuard";
import { createAttachmentTool } from "../attachmentTools";
import { createConfluenceTools } from "../confluenceTools";
import { createWebResearchTool } from "../webResearch";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import { createAzureTools } from "../azureTools";
import { createDevHubTools } from "../devHubTools";
import { createSqlTools } from "../sqlTools";
import { pbiRepoSources } from "../repos/agentRepos";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { createAgentDocTools, docsReadInRun, numberOption, outsideAccessContext, skillsTrace } from "../stage";
import { createVaultCaptureTool } from "../vaultCapture";
import { commitResearch } from "./commitResearch";
import { loadResearchContext } from "./loadResearchContext";
import type { ResearchRun } from "./models/ResearchRun";
import { buildResearchMessage } from "./researchMessage";
import { createResearchTools } from "./researchTools";
import { createFetchDocumentTools } from "../webDocuments/fetchDocumentTool";
import { createWebDocumentTools } from "../webDocuments/webDocumentTools";
import { webDocumentRun, webDocumentsBlock } from "../webDocuments/webDocuments";

type ItemRow = typeof localItem.$inferSelect;

const AGENT = "research";

// One research task (AT-…): one run; on success the result, follow-ups, human tasks, questions and drafts are committed.
// The repos it took from the cache are released whatever happens.
export async function runResearchTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps } = context;
  const info: AgentRunInfo = {
    stage: "research",
    pbiId: requirePbiId(task),
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const run: ResearchRun = { research: null, repos: noRepos(), draft: { result: null, followUps: [], humanTasks: [], questions: [], captures: [], webResearch: [], pages: [] } };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, run));
    const commit = async () => {
      const extra = { commits: run.repos.commits, docsRead: await docsReadInRun(deps, session.runId) };

      await commitResearch(deps.db, run.research!, session.runId, { ...run.draft, result: run.draft.result! }, extra);
    };

    return await session.finish(ran, run.research ? commit : null);
  } finally {
    closeRepos(deps, run.repos);
  }
}

// Each step is a traced phase: context, every repo (clone / refresh / reuse, with time and commit), first message.
async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, run: ResearchRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;
  const depth = Number((task.data as { depth?: number } | null)?.depth ?? 1);

  await session.phase("context", { task: task.id, depth, skills: skillsTrace(skills) });
  run.research = await loadResearchContext(deps, task);
  run.repos = await openRepos(context, session, await pbiRepoSources(deps.db, requirePbiId(task)));

  const webDocuments = await webDocumentRun(context, task, session.runId);
  const firstMessage = [await buildResearchMessage(deps.db, deps.vaultRoot, run.research, run.repos), webDocumentsBlock(webDocuments)].filter(Boolean).join("\n\n");
  const guard = await DuplicateGuard.load(deps.db, requirePbiId(task));

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
      createAttachmentTool(deps.db, requirePbiId(task)),
      ...createResearchTools(run.draft, depth, numberOption(agent, "maxDepth", 2), guard),
      ...(agent.capabilities.webAccess ? [] : [createWebResearchTool(run.draft.webResearch, guard)]),
      ...createFetchDocumentTools(webDocuments),
      ...createWebDocumentTools(deps.db, webDocuments),
      ...createConfluenceTools(deps, agent, access),
      ...createSqlTools(deps, agent, access),
      ...createAzureTools(deps, agent, access),
      ...createDevHubTools(deps, agent, access),
      ...(deps.captureRules ? [createVaultCaptureTool(run.draft.captures, deps.captureRules)] : []),
    ],
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    hasRequiredOutput: () => run.draft.result !== null,
  };
}

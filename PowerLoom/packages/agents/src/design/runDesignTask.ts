import { requirePbiId } from "@powerloom/core";
import { localItem, type PowerLoomDb } from "@powerloom/db";
import { AgentRunSession } from "../AgentRunSession";
import { DuplicateGuard } from "../DuplicateGuard";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import { withPagesRead } from "../relevantPages";
import { pbiRepoSources } from "../repos/agentRepos";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { loadResearchContext } from "../research/loadResearchContext";
import { confluencePagesReadInRun, skillsTrace } from "../stage";
import { recordWaiting } from "../tasks/waiting";
import { AgentToolset } from "../toolset/AgentToolset";
import { ownTools } from "../toolset/ownTools";
import { toolsPromptSection } from "../toolset/toolsPromptSection";
import { commitDesign } from "./commitDesign";
import { buildDesignMessage } from "./designMessage";
import { createDesignTools } from "./designTools";
import type { DesignRun } from "./models/DesignRun";

type ItemRow = typeof localItem.$inferSelect;

const AGENT = "design";

// One design task (DT-…): one run on its PBI; on success the design or the gaps that stop it are committed.
// The repos it took from the cache are released whatever happens.
export async function runDesignTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps } = context;
  const pbiId = requirePbiId(task);
  const info: AgentRunInfo = {
    stage: "design",
    pbiId,
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const run: DesignRun = { context: null, repos: noRepos(), toolset: null, draft: { design: null, gaps: [], captures: [], pages: [] } };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, run));
    const commit = async () => {
      const pages = withPagesRead(run.draft.pages, await confluencePagesReadInRun(deps, session.runId), "Read by design while designing.");

      await commitDesign(deps.db, task, pbiId, session.runId, { ...run.draft, pages });
      await waitForCreatedTasks(deps.db, task, session.runId, run);
    };

    return await session.finish(ran, commit);
  } finally {
    closeRepos(deps, run.repos);
  }
}

// Each step is a traced phase: context, every repo (clone / refresh / reuse), first message.
async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, run: DesignRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;

  await session.phase("context", { task: task.id, skills: skillsTrace(skills) });
  run.context = await loadResearchContext(deps, task);
  run.repos = await openRepos(context, session, await pbiRepoSources(deps.db, requirePbiId(task)), { vault: task.vault });

  const guard = await DuplicateGuard.load(deps.db, requirePbiId(task));
  const toolset = await AgentToolset.open(context, session, task, { repos: run.repos, guard, captures: run.draft.captures });
  const firstMessage = [await buildDesignMessage(deps.db, deps.vaultRoot, run.context, run.repos), toolset.webDocumentsBlock()].filter(Boolean).join("\n\n");
  const shared = toolset.tools(firstMessage);
  const tools = [...shared, ...ownTools(createDesignTools(run.draft, guard), shared)];

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
    hasRequiredOutput: () => hasOutput(run),
  };
}

// A design, or the questions and tasks for the user that stop it, or work handed on with create_task: each counts as a
// finished run.
function hasOutput(run: DesignRun): boolean {
  return run.draft.design !== null || run.draft.gaps.length > 0 || (run.toolset?.tasks.length ?? 0) > 0;
}

// Without a design the task is open again (commitDesign); the tasks the shared tools created hold it like its gaps do.
async function waitForCreatedTasks(db: PowerLoomDb, task: ItemRow, runId: number, run: DesignRun): Promise<void> {
  const created = await run.toolset?.commit(runId);

  if (created && created.taskIds.length > 0 && run.draft.design === null) {
    await recordWaiting(db, task, runId, created.taskIds);
  }
}

import { localItem, workItem } from "@powerloom/db";
import { eq } from "drizzle-orm";
import { AgentRunSession } from "../AgentRunSession";
import { withBudgetNotes } from "../budget/budgetNotes";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import { pbiRepoSources } from "../repos/agentRepos";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { docsReadInRun, skillsTrace } from "../stage";
import { AgentToolset } from "../toolset/AgentToolset";
import { depthOf } from "../toolset/taskLimits";
import { toolsPromptSection } from "../toolset/toolsPromptSection";
import { commitTestReport } from "./commitTestReport";
import type { AutotestRun } from "./models/AutotestRun";
import { REPORT_TOOL, createReportTool } from "./reportTool";
import { buildTestMessage } from "./testMessage";

type ItemRow = typeof localItem.$inferSelect;

const AGENT = "autotest";

// One test task of a PBI (design 2026-10-20): analyse the acceptance criteria against the test cases, plan the cases,
// create the tasks that close the gaps, write the report. Stage 3 adds the stack and the browser.
export async function runAutotestTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps } = context;
  const info: AgentRunInfo = {
    stage: "autotest",
    pbiId: task.pbiId,
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const run: AutotestRun = { pbi: null, repos: noRepos(), toolset: null, draft: { report: null, tasks: [], captures: [] } };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, run));
    const commit = async () => {
      const extra = { commits: run.repos.commits, docsRead: await docsReadInRun(deps, session.runId), docsVault: deps.docsVaultName };

      await commitTestReport(deps.db, task, run.pbi!, session.runId, { ...run.draft, report: run.draft.report! }, extra);
      await run.toolset?.commit(session.runId);
    };

    return await session.finish(ran, run.toolset && run.pbi ? commit : null, run.draft.report !== null);
  } finally {
    closeRepos(deps, run.repos);
  }
}

async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, run: AutotestRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;
  const depth = depthOf(task);

  await session.phase("context", { task: task.id, pbi: task.pbiId, depth, skills: skillsTrace(skills) });
  run.pbi = await loadPbi(deps.db, task);
  run.repos = await openRepos(context, session, await pbiRepoSources(deps.db, run.pbi.adoId), { vault: task.vault });

  const toolset = await AgentToolset.open(context, session, task, { repos: run.repos, depth, createTask: true, tasks: run.draft.tasks, captures: run.draft.captures });
  const firstMessage = [await buildTestMessage(deps.db, deps.vaultRoot, task, run.pbi, run.repos), toolset.webDocumentsBlock()].filter(Boolean).join("\n\n");
  const tools = withBudgetNotes([...toolset.tools(firstMessage), createReportTool(run.draft, toolset.readLog)], () => session.spentUsd, agent.budgets.perRunUsd, REPORT_TOOL);

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
    hasRequiredOutput: () => run.draft.report !== null,
  };
}

// A test task always belongs to a PBI (TaskCreation requires one; create_task's test target is PBI-scoped).
async function loadPbi(db: TaskContext["deps"]["db"], task: ItemRow) {
  const [pbi] = task.pbiId === null ? [] : await db.select().from(workItem).where(eq(workItem.adoId, task.pbiId));

  if (!pbi) {
    throw new Error(`${task.id} has no PBI; a test task needs one.`);
  }

  return pbi;
}

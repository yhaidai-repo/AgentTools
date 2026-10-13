import { localItem } from "@powerloom/db";
import type { ToolDefinition } from "@agenttools/runtime";
import type { AgentRunSession } from "../AgentRunSession";
import { createAttachmentTool } from "../attachmentTools";
import { createAzureTools } from "../azureTools";
import { createConfluenceTools } from "../confluenceTools";
import { createDevHubTools } from "../devHubTools";
import { createTestCaseTools } from "../testCases/testCaseTools";
import type { RepoAccess } from "../models/RepoAccess";
import type { TaskContext } from "../models/TaskContext";
import { createReadPbiTool } from "../pbiContext/readPbiTool";
import { createSqlTools } from "../sqlTools";
import { createAgentDocTools, numberOption, outsideAccessContext } from "../stage";
import { countAgentCreatedTasks } from "../taskCreation/commitCreatedTasks";
import type { TaskCreationLimits } from "../taskCreation/models/TaskCreationLimits";

type ItemRow = typeof localItem.$inferSelect;

// Only these results get a source id the evidence can cite; writing tools stay out (see recordReads). read_pbi and
// read_attachment are listed here, so the session's PBI context doesn't add them again untagged (withPbiContext).
export function readingTools(context: TaskContext, session: AgentRunSession, task: ItemRow, repos: RepoAccess): ToolDefinition<any>[] {
  const { deps, agent } = context;
  const access = outsideAccessContext(agent.id, session.runId, task);

  return [
    ...createAgentDocTools(deps, agent.id, session.runId),
    ...repos.tools,
    ...(task.pbiId === null ? [] : [createAttachmentTool(deps.db, task.pbiId)]),
    createReadPbiTool(deps.db, deps.vaultRoot),
    ...createConfluenceTools(deps, agent, access),
    ...createSqlTools(deps, agent, access),
    ...createAzureTools(deps, agent, access),
    ...createDevHubTools(deps, agent, access),
    ...createTestCaseTools(deps, agent, access),
  ];
}

export async function taskLimits(context: TaskContext, pbiId: number | null, depth: number): Promise<TaskCreationLimits> {
  const { agent, deps } = context;

  return {
    depth,
    maxDepth: numberOption(agent, "maxDepth", 3),
    maxPerRun: numberOption(agent, "maxTasksPerRun", 5),
    maxPerPbi: numberOption(agent, "maxTasksPerPbi", 15),
    createdOnPbi: pbiId === null ? 0 : await countAgentCreatedTasks(deps.db, pbiId),
  };
}

export function depthOf(task: ItemRow): number {
  return Number((task.data as { depth?: number } | null)?.depth ?? 1);
}

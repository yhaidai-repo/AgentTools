import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import { testCaseTools } from "../testCases/testCaseTools";
import { pullRequestTools } from "./pullRequestTools";
import { workItemTools } from "./workItemTools";

// The key is older than the switch's other tools (it switched read_test_cases alone); kept, so the switches agents
// already saved carry over without touching their stored configs.
export const ADO_INTEGRATION = "adoTestCases";

// The Azure DevOps tools (user decision 2026-10-14), for an agent with the integration switched on in its Config,
// while the run's vault's Azure DevOps integration is on: work items, pull requests with their threads and changed
// files, and the PBI's Test Cases. Read only, with the vault's PAT; every call goes to the data access log.
export function createAdoTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext): ToolDefinition<any>[] {
  const isOn = agent.capabilities.integrations?.[ADO_INTEGRATION] === true;

  if (!isOn || !deps.ado) {
    return [];
  }

  return [...workItemTools(deps, context, deps.ado), ...pullRequestTools(deps, context, deps.ado), ...testCaseTools(deps, context, deps.ado)];
}

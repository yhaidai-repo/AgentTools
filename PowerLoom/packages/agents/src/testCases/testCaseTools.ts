import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import { AdoRequestError } from "@powerloom/ado";
import type { AdoAccess } from "../models/AdoAccess";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import type { TestCaseRecord } from "../models/TestCaseRecord";
import { defineOutsideTool } from "../outsideAccess";
import { fetchTestCases } from "./fetchTestCases";
import { saveTestCases } from "./saveTestCases";

export const READ_TEST_CASES_INTEGRATION = "adoTestCases";

// read_test_cases (user decision 2026-10-13), for an agent with the integration switched on in its Config, on a run
// with a PBI while the vault's Azure DevOps integration is on: the Test Cases the PBI links (Tested By) are read, saved
// to the PBI (TC-<id>, part of its context for every later agent and chat) and listed. Read only; logged like every
// outside read.
export function createTestCaseTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext): ToolDefinition<any>[] {
  const isOn = agent.capabilities.integrations?.[READ_TEST_CASES_INTEGRATION] === true;
  const pbiId = context.pbiId;

  if (!isOn || !deps.ado || pbiId === null) {
    return [];
  }

  return [readTestCasesTool(deps, context, deps.ado, pbiId)];
}

function readTestCasesTool(deps: AgentDeps, context: OutsideAccessContext, access: AdoAccess, pbiId: number) {
  return defineOutsideTool(deps.outside, context, {
    name: "read_test_cases",
    description: `Read the Azure DevOps Test Cases that test PBI-${pbiId} (its Tested By links), with their steps and expected results, and save them to the PBI. Lists them; read one in full with read_pbi(TC-<id>). Call it again to refresh after the test cases change in ADO.`,
    input: {},
    resource: () => ({ kind: "ado", resource: "Azure DevOps test cases", target: access.orgUrl }),
    request: () => `Tested By of PBI-${pbiId}`,
    handler: async () => readAndSave(deps, access, pbiId),
  });
}

async function readAndSave(deps: AgentDeps, access: AdoAccess, pbiId: number): Promise<OutsideToolResult> {
  try {
    const cases = await fetchTestCases(access.client, pbiId);

    await saveTestCases(deps.db, pbiId, cases);

    return { text: listText(pbiId, cases), rows: cases.length };
  } catch (error) {
    return failure(error);
  }
}

function listText(pbiId: number, cases: TestCaseRecord[]): string {
  if (cases.length === 0) {
    return `PBI-${pbiId} links no Test Cases in Azure DevOps.`;
  }

  const lines = cases.map((item) => `- TC-${item.adoId} (${item.state}, ${stepCount(item)} steps): ${item.title}`);

  return [`${cases.length} Test Case(s) of PBI-${pbiId}, saved to the PBI. Read one in full with read_pbi(TC-<id>).`, ...lines].join("\n");
}

function stepCount(item: TestCaseRecord): number {
  return item.stepsMd.split("\n").filter((line) => /^\d+\. /.test(line)).length;
}

// 401/403: the PAT lost its rights or expired; anything else is an ordinary failure.
function failure(error: unknown): OutsideToolResult {
  const message = error instanceof Error ? error.message : String(error);
  const denied = error instanceof AdoRequestError && (error.status === 401 || error.status === 403);

  return { text: `Azure DevOps refused or failed: ${message}`, isError: true, denied };
}

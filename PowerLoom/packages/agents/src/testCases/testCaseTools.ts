import type { ToolDefinition } from "@agenttools/runtime";
import { TEST_CASES, adoFailure, adoResource } from "../ado/adoToolResults";
import type { AdoAccess } from "../models/AdoAccess";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import type { TestCaseRecord } from "../models/TestCaseRecord";
import { defineOutsideTool } from "../outsideAccess";
import { fetchTestCases } from "./fetchTestCases";
import { saveTestCases } from "./saveTestCases";

// read_test_cases (user decision 2026-10-13), one of the Azure DevOps tools, on a run with a PBI: the Test Cases the
// PBI links (Tested By) are read, saved to the PBI (TC-<id>, part of its context for every later agent and chat) and
// listed. Read only; logged like every outside read.
export function testCaseTools(deps: AgentDeps, context: OutsideAccessContext, access: AdoAccess): ToolDefinition<any>[] {
  const pbiId = context.pbiId;

  if (pbiId === null) {
    return [];
  }

  return [readTestCasesTool(deps, context, access, pbiId)];
}

function readTestCasesTool(deps: AgentDeps, context: OutsideAccessContext, access: AdoAccess, pbiId: number) {
  return defineOutsideTool(deps.outside, context, {
    name: "read_test_cases",
    description: `Read the Azure DevOps Test Cases that test PBI-${pbiId} (its Tested By links), with their steps and expected results, and save them to the PBI. Lists them; read one in full with read_pbi(TC-<id>). Call it again to refresh after the test cases change in ADO.`,
    input: {},
    resource: () => adoResource(access, TEST_CASES),
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
    return adoFailure(error);
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

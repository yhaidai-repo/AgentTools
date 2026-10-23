import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AdoRequestError, TESTED_BY_RELATION, type AdoClient } from "@powerloom/ado";
import type { DataAccessLog } from "../DataAccessLog";
import type { AgentDeps } from "../models/AgentDeps";
import type { DataAccessEntry } from "../models/DataAccessEntry";
import { fetchTestCases } from "./fetchTestCases";
import { stepsMarkdown } from "./testCaseMarkdown";
import { testCaseTools } from "./testCaseTools";

const context = { vault: "work-projects", agentId: "refinement", runId: 7, owner: "powerloom-run-7", taskId: "RT-36973-001", pbiId: 36973 };

const STEPS = `<steps id="0" last="4"><step id="2" type="ActionStep"><parameterizedString isformatted="true">&lt;P&gt;Open the &lt;B&gt;Features&lt;/B&gt; tab&lt;/P&gt;</parameterizedString><parameterizedString isformatted="true">&lt;P&gt;The checkbox shows&lt;/P&gt;</parameterizedString><description/></step><compref id="3" ref="500"/></steps>`;
const SHARED = `<steps id="0" last="2"><step id="2" type="ActionStep"><parameterizedString isformatted="true">Sign in as admin</parameterizedString><parameterizedString isformatted="true"/><description/></step></steps>`;

function depsWith(client: Partial<AdoClient>): { deps: AgentDeps; entries: DataAccessEntry[] } {
  const entries: DataAccessEntry[] = [];
  const log = { record: async (entry: DataAccessEntry) => { entries.push(entry); } } as unknown as DataAccessLog;
  const outside = { log, requests: { request: async () => ({ id: "HT-36973-001", created: true }) } };
  const ado = { client: client as AdoClient, orgUrl: "https://dev.azure.com/org" };

  return { deps: { outside, ado } as unknown as AgentDeps, entries };
}

const client: Partial<AdoClient> = {
  getLinkedIds: async (id, relation) => (id === 36973 && relation === TESTED_BY_RELATION ? [37274] : []),
  getWorkItems: async (ids) => ids.map((id) => (id === 500
    ? { id, rev: 2, fields: { "Microsoft.VSTS.TCM.Steps": SHARED } }
    : { id, rev: 3, fields: { "System.Title": "Display the checkbox", "System.State": "Ready", "Microsoft.VSTS.Common.Priority": 2, "Microsoft.VSTS.TCM.Steps": STEPS } })),
};

function toolsOf(deps: AgentDeps, pbiId: number | null) {
  return testCaseTools(deps, { ...context, pbiId }, deps.ado!);
}

describe("testCaseTools", () => {
  it("gives the tool only on a run with a PBI", () => {
    assert.equal(toolsOf(depsWith(client).deps, null).length, 0);
    assert.deepEqual(toolsOf(depsWith(client).deps, 36973).map((tool) => tool.name), ["read_test_cases"]);
  });

  it("logs a refused token as denied and asks the user for access", async () => {
    const refusing: Partial<AdoClient> = { getLinkedIds: async () => { throw new AdoRequestError(401, "token expired"); } };
    const { deps, entries } = depsWith(refusing);
    const [tool] = toolsOf(deps, 36973);

    const result = await tool.handler({});

    assert.equal(result.isError, true);
    assert.match(result.text, /HT-36973-001/);
    assert.equal(entries[0].outcome, "denied");
    assert.equal(entries[0].kind, "ado");
  });
});

describe("fetchTestCases", () => {
  it("reads the linked cases with their steps, Shared Steps expanded in place", async () => {
    const [testCase] = await fetchTestCases(client as AdoClient, 36973);

    assert.deepEqual({ ...testCase, stepsMd: undefined }, { adoId: 37274, title: "Display the checkbox", state: "Ready", priority: 2, rev: 3, stepsMd: undefined, parameters: null });
    assert.equal(testCase.stepsMd, "1. Open the **Features** tab\n   Expected: The checkbox shows\n2. Sign in as admin _(shared steps 500)_");
  });

  it("has nothing for a PBI without Tested By links", async () => {
    assert.deepEqual(await fetchTestCases(client as AdoClient, 1), []);
  });
});

describe("stepsMarkdown", () => {
  it("names Shared Steps Azure DevOps didn't return instead of dropping them", () => {
    assert.equal(stepsMarkdown([{ kind: "shared", sharedStepsId: 9 }], new Map()), "1. (Shared Steps 9: not readable in Azure DevOps)");
    assert.equal(stepsMarkdown([], new Map()), "(no steps)");
  });
});

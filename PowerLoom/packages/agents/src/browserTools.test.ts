import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BrowserAction, DevHubClient } from "@powerloom/devhub";
import { createBrowserTools } from "./browserTools";
import type { DataAccessLog } from "./DataAccessLog";
import type { AgentDeps } from "./models/AgentDeps";
import type { DataAccessEntry } from "./models/DataAccessEntry";

const context = { vault: "work-projects", agentId: "autotest", runId: 7, taskId: "TT-1-001", pbiId: 1 };
const view = { url: "https://localhost:5001/login", title: "Sign in", snapshot: '- textbox "User name"\n- button "Sign in"', snapshotCut: false };

function toolsWith(client: Partial<DevHubClient>) {
  const entries: DataAccessEntry[] = [];
  const outputs: string[][] = [];
  const log = { record: async (entry: DataAccessEntry) => { entries.push(entry); } } as unknown as DataAccessLog;
  const db = { select: () => ({ from: () => ({ where: async () => [{ outputs: [] }] }) }), update: () => ({ set: (row: { outputs: string[] }) => ({ where: async () => { outputs.push(row.outputs); } }) }) };
  const deps = { outside: { log, requests: { request: async () => ({ id: "HT-1-001", created: true }) } }, db } as unknown as AgentDeps;
  const access = { client: client as DevHubClient, url: "http://host.docker.internal:47811" };
  const tools = createBrowserTools(deps, context, access, "powerloom-run-7", true);

  return { tool: (name: string) => tools.find((tool) => tool.name === name)!, entries, outputs };
}

describe("createBrowserTools", () => {
  it("opens a case as the run's owner and shows the page", async () => {
    let request: unknown = null;
    const openBrowser = async (input: unknown) => {
      request = input;

      return { ok: true as const, value: view };
    };
    const { tool, entries } = toolsWith({ openBrowser });

    const result = await tool("browser_open").handler({ case: "TC-1234", url: "https://localhost:5001/login" });

    assert.deepEqual(request, { owner: "powerloom-run-7", case: "TC-1234", url: "https://localhost:5001/login", headless: true });
    assert.match(result.text, /^Sign in — https:\/\/localhost:5001\/login\n\n- textbox "User name"/);
    assert.equal(entries[0].resource, "browser:TC-1234");
    assert.equal(entries[0].outcome, "ok");
  });

  it("logs what an action did, never what it typed", async () => {
    let sent: BrowserAction | null = null;
    const browserAct = async (action: BrowserAction) => {
      sent = action;

      return { ok: true as const, value: view };
    };
    const { tool, entries } = toolsWith({ browserAct });

    await tool("browser_act").handler({ action: "fill", role: "textbox", name: "Password", valueName: "pvs-test-password" });

    assert.equal(sent!.valueName, "pvs-test-password");
    assert.equal(entries[0].request, 'fill textbox "Password"');
  });

  it("lists a closed case's recording among the run's outputs", async () => {
    const closeBrowser = async () => ({ ok: true as const, value: { case: "TC-1234", artifacts: ["D:/x/TC-1234/trace.zip", "D:/x/TC-1234/video.webm"] } });
    const { tool, outputs } = toolsWith({ closeBrowser });

    const result = await tool("browser_close").handler({});

    assert.deepEqual(outputs, [["D:/x/TC-1234/trace.zip", "D:/x/TC-1234/video.webm"]]);
    assert.match(result.text, /^Closed TC-1234\./);
  });

  it("passes DevHub's refusal on as an error", async () => {
    const browserSnapshot = async () => ({ ok: false as const, message: "No browser case is open (POST /browser opens one).", denied: false });
    const { tool, entries } = toolsWith({ browserSnapshot });

    const result = await tool("browser_snapshot").handler({});

    assert.equal(result.isError, true);
    assert.equal(entries[0].outcome, "failed");
  });
});

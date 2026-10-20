import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import type { DevHubClient } from "@powerloom/devhub";
import type { DataAccessLog } from "./DataAccessLog";
import { DEVHUB_INTEGRATION, createDevHubTools, stackOwner } from "./devHubTools";
import type { AgentDeps } from "./models/AgentDeps";
import type { DataAccessEntry } from "./models/DataAccessEntry";

const context = { vault: "work-projects", agentId: "tester", runId: 7, taskId: "AT-1-001", pbiId: 1 };

function agentWith(devHub: boolean): AgentDefinition {
  return { capabilities: { webAccess: false, integrations: { [DEVHUB_INTEGRATION]: devHub } }, limits: { maxTurns: 40, timeoutMinutes: 20 } } as unknown as AgentDefinition;
}

function depsWith(client: Partial<DevHubClient> | null): { deps: AgentDeps; entries: DataAccessEntry[] } {
  const entries: DataAccessEntry[] = [];
  const log = { record: async (entry: DataAccessEntry) => { entries.push(entry); } } as unknown as DataAccessLog;
  const outside = { log, requests: { request: async () => ({ id: "HT-1-001", created: true }) } };
  const devHub = client ? { client: client as DevHubClient, url: "http://host.docker.internal:47811" } : null;

  return { deps: { outside, devHub } as unknown as AgentDeps, entries };
}

function toolNamed(deps: AgentDeps, name: string) {
  return createDevHubTools(deps, agentWith(true), context).find((tool) => tool.name === name)!;
}

describe("createDevHubTools", () => {
  it("gives no tools while the agent's switch or the vault's DevHub is off", () => {
    assert.equal(createDevHubTools(depsWith({}).deps, agentWith(false), context).length, 0);
    assert.equal(createDevHubTools(depsWith(null).deps, agentWith(true), context).length, 0);
  });

  it("gives the stack tools, the case tools and the Playwright MCP tools when both are on", () => {
    const names = createDevHubTools(depsWith({}).deps, agentWith(true), context).map((tool) => tool.name);

    assert.deepEqual(names.slice(0, 10), ["list_services", "start_stack", "stack_status", "stack_logs", "stop_stack", "list_secret_names", "http_request", "browser_open", "browser_close", "browser_type_secret"]);
    assert.ok(names.includes("browser_navigate") && names.includes("browser_snapshot") && names.includes("browser_take_screenshot"));
    assert.ok(!names.includes("browser_run_code_unsafe") && !names.includes("browser_start_video"));
  });

  it("lists the services as a table and logs the call as a local stack read", async () => {
    const services = async () => ({ ok: true as const, value: [{ name: "signals", note: "Signals AppHost", localUrl: "https://localhost:7456", consumesBus: false }] });
    const { deps, entries } = depsWith({ services });

    const result = await toolNamed(deps, "list_services").handler({});

    assert.match(result.text, /\| signals \| Signals AppHost \| https:\/\/localhost:7456 \| no \|/);
    assert.equal(entries[0].kind, "localStack");
    assert.equal(entries[0].outcome, "ok");
  });

  it("stops only as the run's owner", async () => {
    let owner = "";
    const stop = async (name: string) => {
      owner = name;

      return { ok: true as const, value: { output: ["Stopped signals"] } };
    };

    const result = await toolNamed(depsWith({ stop }).deps, "stop_stack").handler({});

    assert.equal(owner, stackOwner(7));
    assert.match(result.text, /^Stopped\./);
  });

  it("hands a refused token to the access request flow", async () => {
    const status = async () => ({ ok: false as const, message: "DevHub refused the token.", denied: true });
    const { deps, entries } = depsWith({ status });

    const result = await toolNamed(deps, "stack_status").handler({});

    assert.equal(result.isError, true);
    assert.equal(entries[0].outcome, "denied");
    assert.match(result.text, /HT-1-001/);
  });
});

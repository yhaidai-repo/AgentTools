import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { COMMANDS, type CommandContext } from "@powerloom/core";
import type { SqlReader } from "@powerloom/sql";
import { ADO_INTEGRATION } from "../ado/adoTools";
import { AGENT_DEFAULTS } from "../agentDefaults";
import { commandToolName } from "../commandTool";
import { DEVHUB_INTEGRATION } from "../devHubTools";
import { commandTools } from "../commandTool";
import type { AgentDeps } from "../models/AgentDeps";
import { isOutsideTool } from "../outsideAccess";
import { classifyToolCall } from "../toolKinds";
import { COMMANDS_SOURCE } from "../toolset/toolSources";
import { chatSessionTools, chatTools } from "./chatTools";
import { CHAT_AGENT_ID } from "./models/ChatPrincipal";

// What the owner's rule asks of a changing tool (2026-10-24): it replaces a page or dialog, so it says what to ask for,
// confirm, show or offer first.
const ASK_OR_CONFIRM = /\b(ask|confirm|show|offer)\w*\b/i;
const POWERLOOM_MD = new URL("../../../../templates/vault/POWERLOOM.md", import.meta.url);

// Deps with every reader that can share a command's name switched on (Read SQL: sql_query, sql_describe, sql_databases).
function fakeDeps(): AgentDeps {
  const log = { record: async () => {} };
  const connection = { name: "pos", server: "sql01", database: "Pos", connectionString: "Server=sql01", enabled: true };

  return {
    db: {},
    docsRoot: "/vaults/work",
    docsExclude: [],
    docUsageLog: null,
    accessLog: log,
    outside: { log, requests: { request: async () => ({ id: "HT-1-001", created: true }) } },
    sql: { reader: {} as SqlReader, connections: [connection] },
    confluence: null,
    azure: null,
    devHub: null,
    ado: null,
  } as unknown as AgentDeps;
}

function sessionTools(commands = {} as CommandContext) {
  const chat = AGENT_DEFAULTS.find((agent) => agent.id === CHAT_AGENT_ID)!;

  return chatTools(fakeDeps(), chat, { vault: "work", client: "test", sessionId: "s1" }, commands);
}

describe("a chat session's tools", () => {
  it("never falls back to generic SQL commands when the grant or session access is off", () => {
    const base = AGENT_DEFAULTS.find((agent) => agent.id === CHAT_AGENT_ID)!;
    const denied = { ...base, capabilities: { ...base.capabilities, integrations: { ...base.capabilities.integrations, readSql: false } } };
    for (const [deps, agent] of [[fakeDeps(), denied], [{ ...fakeDeps(), sql: null }, base], [{ ...fakeDeps(), sql: { reader: {}, connections: [] } }, base]] as const) {
      const result = chatSessionTools(deps as AgentDeps, agent, { vault: "vault-A", client: "test", sessionId: "s1" }, {} as CommandContext);
      assert.deepEqual(result.tools.filter((tool) => tool.name.startsWith("sql_")).map((tool) => tool.name), []);
      assert.deepEqual(result.offered.filter((tool) => tool.name.startsWith("sql_")), []);
    }
    assert.deepEqual(commandTools({} as CommandContext).filter((tool) => tool.name.startsWith("sql_")).map((tool) => tool.name).sort(), ["sql_databases", "sql_describe", "sql_query"]);
  });

  it("binds all granted SQL readers to the session connections even if a caller supplies another vault", async () => {
    const calls: unknown[][] = [];
    const answer = { ok: true, rows: { columns: [], rows: [], truncated: false, moreResultSets: 0 } };
    const deps = fakeDeps();
    deps.sql!.reader = {
      query: async (...args: unknown[]) => (calls.push(args), answer),
      listTables: async (...args: unknown[]) => (calls.push(args), answer),
      listDatabases: async (...args: unknown[]) => (calls.push(args), answer),
    } as unknown as SqlReader;
    const chat = AGENT_DEFAULTS.find((agent) => agent.id === CHAT_AGENT_ID)!;
    const { tools, offered } = chatSessionTools(deps, chat, { vault: "vault-A", client: "test", sessionId: "s1" }, {} as CommandContext);
    const sql = tools.filter((tool) => tool.name.startsWith("sql_"));
    assert.deepEqual(sql.map((tool) => tool.name).sort(), ["sql_databases", "sql_describe", "sql_query"]);
    for (const tool of sql) {
      assert.equal("vault" in tool.input, false);
      assert.equal(offered.find((offer) => offer.name === tool.name)?.source, "Read SQL (SQL Server)");
      await tool.handler({ vault: "vault-B", connection: "pos", sql: "SELECT 1" });
    }
    assert.deepEqual(calls, [["Server=sql01"], ["Server=sql01", "SELECT 1", undefined], ["Server=sql01", undefined]]);
  });

  it("have unique names, so the MCP server starts the session", () => {
    const names = sessionTools().map((tool) => tool.name);

    assert.deepEqual(names.filter((name, index) => names.indexOf(name) !== index), []);
  });

  it("are offered to the Tools tab each once, with what gave it", () => {
    const chat = AGENT_DEFAULTS.find((agent) => agent.id === CHAT_AGENT_ID)!;
    const { tools, offered } = chatSessionTools(fakeDeps(), chat, { vault: "work", client: "test", sessionId: "s1" }, {} as CommandContext);
    const sourceOf = (name: string) => offered.find((tool) => tool.name === name)?.source;

    assert.deepEqual(offered.map((tool) => tool.name), tools.map((tool) => tool.name));
    assert.equal(sourceOf("pbi_read"), COMMANDS_SOURCE);
    assert.equal(sourceOf("list_repos"), "Every agent");
    assert.equal(sourceOf("sql_query"), "Read SQL (SQL Server)");
  });

  it("log every call under a kind the Tools tab names (none as Other)", () => {
    const chat = AGENT_DEFAULTS.find((agent) => agent.id === CHAT_AGENT_ID)!;
    const { offered } = chatSessionTools(fakeDeps(), chat, { vault: "work", client: "test", sessionId: "s1" }, {} as CommandContext);
    const other = offered.filter((tool) => !isOutsideTool(tool.name) && classifyToolCall(tool.name, {}).kind === "other");

    assert.deepEqual(other.map((tool) => tool.name), []);
  });

  it("mark the tools that act or save as not read-only, the browser's from its catalog", () => {
    const base = AGENT_DEFAULTS.find((agent) => agent.id === CHAT_AGENT_ID)!;
    const chat = { ...base, capabilities: { ...base.capabilities, integrations: { ...base.capabilities.integrations, [DEVHUB_INTEGRATION]: true, [ADO_INTEGRATION]: true } } };
    const deps = { ...fakeDeps(), devHub: { client: {} }, ado: { client: {} } } as unknown as AgentDeps;
    const readOnly = new Map(chatTools(deps, chat, { vault: "work", client: "test", sessionId: "s1" }, {} as CommandContext).map((tool) => [tool.name, tool.annotations?.readOnly]));

    assert.deepEqual(["browser_click", "browser_type", "browser_fill_form", "browser_open", "browser_type_secret", "http_request", "start_stack", "read_test_cases"].map((name) => [name, readOnly.get(name)]).filter(([, value]) => value !== false), []);
    assert.deepEqual(["browser_snapshot", "list_services", "stack_logs", "list_secret_names", "sql_query", "list_repos"].map((name) => [name, readOnly.get(name)]).filter(([, value]) => value !== true), []);
  });

  it("include every command, the session's own reader standing in for one of the same name", () => {
    const names = new Set(sessionTools().map((tool) => tool.name));

    assert.deepEqual(COMMANDS.map((command) => commandToolName(command.name)).filter((name) => !names.has(name)), []);
  });

  it("say for every changing command what to ask, confirm or show the user first", () => {
    const silent = COMMANDS.filter((command) => command.effect !== "read" && !ASK_OR_CONFIRM.test(command.description)).map((command) => command.name);

    assert.deepEqual(silent, []);
  });

  it("are the ones the vault's POWERLOOM.md names", async () => {
    const names = new Set(sessionTools().map((tool) => tool.name));
    const named = [...(await readFile(POWERLOOM_MD, "utf8")).matchAll(/`([a-z][a-zA-Z]*(?:_[a-zA-Z]+)+)`/g)].map((match) => match[1]);

    assert.deepEqual([...new Set(named)].filter((name) => !names.has(name)), []);
  });

  it("write notes into the session's vault only, whatever vault the call names", async () => {
    const vaults: string[] = [];
    const powerloom = { addRegisterRecord: async (vault: string) => (vaults.push(vault), { ok: true, value: "KI-001" }) };
    const tool = sessionTools({ powerloom } as unknown as CommandContext).find((candidate) => candidate.name === "register_add")!;

    const result = await tool.handler({ vault: "other", project: "pos", kind: "issues", title: "Wrong total", text: "Sums twice." });
    const inputs = ["vault_capture", "register_add", "register_close"].map((name) => Object.keys(sessionTools().find((candidate) => candidate.name === name)!.input));

    assert.equal(result.isError, undefined);
    assert.deepEqual(vaults, ["work"]);
    assert.deepEqual(inputs.filter((keys) => keys.includes("vault")), []);
  });

  it("captures the MCP session automatically and keeps a supplied actual chat id for record writes", async () => {
    const writes: any[] = [];
    const powerloom = { addRegisterRecord: async (vault: string, record: unknown) => (writes.push({ vault, record }), { ok: true, value: "KI-001" }), createWwwRecord: async (record: unknown) => (writes.push(record), { ok: true, value: 1 }) };
    const tools = sessionTools({ powerloom } as unknown as CommandContext);
    const result = await tools.find((tool) => tool.name === "register_add")!.handler({ project: "pos", kind: "issues", title: "Wrong total", text: "Sums twice", context: { chatId: "codex-123", sessionId: "wrong-session" } });
    assert.notEqual(result.isError, true);
    assert.deepEqual(writes[0].record.context, { chatId: "codex-123", sessionId: "s1" });
    assert.equal("vault" in tools.find((tool) => tool.name === "www_create")!.input, false);
  });

  it("name other tools as the session sees them, with _ (vault_registers, not vault.registers)", () => {
    const dotted = COMMANDS.map((command) => command.name).filter((name) => name.includes("."));
    const pattern = new RegExp(`(?<![\\w.])(${dotted.map((name) => name.replace(/\./g, "\\.")).join("|")})(?!\\w)`);
    const texts = (command: (typeof COMMANDS)[number]) => [command.description, ...Object.values((command.input as unknown as { shape: Record<string, { description?: string }> }).shape).map((field) => field.description ?? "")];
    const named = COMMANDS.flatMap((command) => texts(command).filter((text) => pattern.test(text)).map((text) => `${command.name}: ${pattern.exec(text)?.[1]}`));

    assert.deepEqual(named, []);
  });

  it("that change PowerLoom are all in POWERLOOM.md's list of tools to ask first about", async () => {
    const text = await readFile(POWERLOOM_MD, "utf8");
    const unlisted = COMMANDS.filter((command) => command.effect !== "read").map((command) => commandToolName(command.name)).filter((name) => !text.includes(`\`${name}\``));

    assert.deepEqual(unlisted, []);
  });
});

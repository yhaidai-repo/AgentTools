import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { COMMANDS, type CommandContext } from "@powerloom/core";
import type { SqlReader } from "@powerloom/sql";
import { AGENT_DEFAULTS } from "../agentDefaults";
import { commandToolName } from "../commandTool";
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
  const connection = { name: "pvs", server: "sql01", database: "Pvs", connectionString: "Server=sql01", enabled: true };

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

    const result = await tool.handler({ vault: "other", project: "pvs", kind: "issues", title: "Wrong total", text: "Sums twice." });
    const inputs = ["vault_capture", "register_add", "register_close"].map((name) => Object.keys(sessionTools().find((candidate) => candidate.name === name)!.input));

    assert.equal(result.isError, undefined);
    assert.deepEqual(vaults, ["work"]);
    assert.deepEqual(inputs.filter((keys) => keys.includes("vault")), []);
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

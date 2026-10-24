import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import type { CommandContext } from "@powerloom/core";
import { createAdoTools } from "../ado/adoTools";
import { createChatAttachmentTool } from "../attachmentTools";
import { createAzureTools } from "../azure/azureTools";
import { commandTools } from "../commandTool";
import { chatTestCaseTools } from "../testCases/testCaseTools";
import { createConfluenceTools } from "../confluenceTools";
import { chatOwner, createDevHubTools } from "../devHubTools";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import { listReposTool } from "../refinement/refinementTools";
import { createSqlTools } from "../sqlTools";
import { createAgentDocTools } from "../stage";
import { withChatLogging } from "./chatToolLogging";
import type { ChatPrincipal } from "./models/ChatPrincipal";

// The tools a chat gets through the MCP server (design powerloom-mcp, 2026-10-23): the agents' reading tools, built by
// the same builders with the `chat` agent's grants, plus every PowerLoom command (pbi_read, item_close, …). Outside
// reads are logged like an agent's; a denied read raises an access request, without a task to re-run.
export function chatTools(deps: AgentDeps, agent: AgentDefinition, principal: ChatPrincipal, commands: CommandContext): ToolDefinition<any>[] {
  const access: OutsideAccessContext = { vault: principal.vault, agentId: agent.id, runId: null, owner: chatOwner(principal.sessionId), taskId: null, pbiId: null };
  const readers = readingTools(deps, agent, access, `CHAT-${principal.sessionId}`);

  const sessionVault = (command: { name: string }) => (WRITES_INTO_SESSION_VAULT.has(command.name) ? { vault: principal.vault } : {});

  return withChatLogging([...readers, ...withoutTaken(commandTools(commands, sessionVault), readers)], deps.accessLog, access);
}

// The capture tools (stage 5) write the notes of the chat's own vault: the session's vault, never one the chat names, so
// a chat in one vault can't write into another.
const WRITES_INTO_SESSION_VAULT = new Set(["vault.capture", "register.add", "register.close"]);

// A reader bound to the session's vault replaces the command of the same name that takes the vault as an argument
// (sql_query, sql_describe, sql_databases): one tool per name, the session-scoped one.
function withoutTaken(commands: ToolDefinition<any>[], readers: ToolDefinition<any>[]): ToolDefinition<any>[] {
  const taken = new Set(readers.map((tool) => tool.name));

  return commands.filter((tool) => !taken.has(tool.name));
}

// The readers that change something outside: a stack on DevHub, a request from the host.
const WRITING_READERS = new Set(["start_stack", "stop_stack", "http_request"]);

// read_pbi is left out: the chat has the same command as pbi_read. The tools a run binds to its task's PBI
// (read_attachment, read_test_cases) take the PBI as an argument here.
function readingTools(deps: AgentDeps, agent: AgentDefinition, access: OutsideAccessContext, session: string): ToolDefinition<any>[] {
  const tools: ToolDefinition<any>[] = [
    ...createAgentDocTools(deps, agent.id, session),
    listReposTool(deps.db, access.vault),
    createChatAttachmentTool(deps.db),
    ...createConfluenceTools(deps, agent, access),
    ...createSqlTools(deps, agent, access),
    ...createAzureTools(deps, agent, access),
    ...createDevHubTools(deps, agent, access),
    ...createAdoTools(deps, agent, access, chatTestCaseTools),
  ];

  return tools.map((tool) => ({ ...tool, annotations: tool.annotations ?? { readOnly: !WRITING_READERS.has(tool.name) } }));
}

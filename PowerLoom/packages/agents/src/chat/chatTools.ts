import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import { EVERY_AGENT, type CommandContext, type OfferedTool } from "@powerloom/core";
import { ADO_INTEGRATION, createAdoTools } from "../ado/adoTools";
import { createChatAttachmentTool } from "../attachmentTools";
import { createAzureTools } from "../azure/azureTools";
import { commandTools } from "../commandTool";
import { chatTestCaseTools } from "../testCases/testCaseTools";
import { CONFLUENCE_INTEGRATION, createConfluenceTools } from "../confluenceTools";
import { chatOwner, createDevHubTools, DEVHUB_INTEGRATION } from "../devHubTools";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import { listReposTool } from "../refinement/refinementTools";
import { createSqlTools, READ_SQL_INTEGRATION } from "../sqlTools";
import { createGitHubReadTools, GITHUB_READ_INTEGRATION } from "../github/githubReadTools";
import { createGoogleDriveTools, GOOGLE_DRIVE_INTEGRATION } from "../googleDrive/googleDriveTools";
import { createAgentDocTools } from "../stage";
import type { ToolGroup } from "../toolset/models/ToolGroup";
import { COMMANDS_SOURCE, grantSource, offeredTools, READ_AZURE_SOURCE, toolsOf } from "../toolset/toolSources";
import { withChatLogging } from "./chatToolLogging";
import type { ChatPrincipal } from "./models/ChatPrincipal";

// The tools a chat gets through the MCP server (design powerloom-mcp, 2026-10-23): the agents' reading tools, built by
// the same builders with the `chat` agent's grants, plus every PowerLoom command (pbi_read, item_close, …). Outside
// reads are logged like an agent's; a denied read raises an access request, without a task to re-run.
export function chatTools(deps: AgentDeps, agent: AgentDefinition, principal: ChatPrincipal, commands: CommandContext): ToolDefinition<any>[] {
  return chatSessionTools(deps, agent, principal, commands).tools;
}

/** A chat session's tools, and what gave each (for the Tools tab). */
export function chatSessionTools(deps: AgentDeps, agent: AgentDefinition, principal: ChatPrincipal, commands: CommandContext): { tools: ToolDefinition<any>[]; offered: OfferedTool[] } {
  const access: OutsideAccessContext = { vault: principal.vault, agentId: agent.id, runId: null, owner: chatOwner(principal.sessionId), taskId: null, pbiId: null };
  const readers = readingGroups(deps, agent, access, `CHAT-${principal.sessionId}`);
  const sessionVault = (command: { name: string }) => (WRITES_INTO_SESSION_VAULT.has(command.name) ? { vault: principal.vault } : {});
  const groups = [...readers, { source: COMMANDS_SOURCE, tools: withoutTaken(commandTools(commands, sessionVault), toolsOf(readers)) }];

  return { tools: withChatLogging(toolsOf(groups), deps.accessLog, access), offered: offeredTools(groups) };
}

// The capture tools (stage 5) write the notes of the chat's own vault: the session's vault, never one the chat names, so
// a chat in one vault can't write into another.
const WRITES_INTO_SESSION_VAULT = new Set(["vault.capture", "register.add", "register.close", "failure.report"]);

// Generic SQL commands accept a caller-selected vault and have no session grant. Never offer them in a chat,
// including when the grant-checked readers are absent. Other callers retain the generic command contracts.
const SESSION_SQL_TOOLS = new Set(["sql_query", "sql_describe", "sql_databases"]);

function withoutTaken(commands: ToolDefinition<any>[], readers: ToolDefinition<any>[]): ToolDefinition<any>[] {
  const taken = new Set([...SESSION_SQL_TOOLS, ...readers.map((tool) => tool.name)]);

  return commands.filter((tool) => !taken.has(tool.name));
}

// The readers that change something outside: a stack on DevHub, a request from the host. DevHub's other tools (the
// browser, secrets) act on what runs there, so they count as changing unless a tool says otherwise (its annotations).
const WRITING_READERS = new Set(["start_stack", "stop_stack", "http_request"]);

// read_pbi is left out: the chat has the same command as pbi_read. The tools a run binds to its task's PBI
// (read_attachment, read_test_cases) take the PBI as an argument here.
function readingGroups(deps: AgentDeps, agent: AgentDefinition, access: OutsideAccessContext, session: string): ToolGroup[] {
  const groups: ToolGroup[] = [
    { source: EVERY_AGENT, tools: [...createAgentDocTools(deps, agent.id, session), listReposTool(deps.db, access.vault), createChatAttachmentTool(deps.db)] },
    { source: grantSource(agent, CONFLUENCE_INTEGRATION), tools: createConfluenceTools(deps, agent, access) },
    { source: grantSource(agent, READ_SQL_INTEGRATION), tools: createSqlTools(deps, agent, access) },
    { source: grantSource(agent, GOOGLE_DRIVE_INTEGRATION), tools: createGoogleDriveTools(deps, agent, access) },
    { source: grantSource(agent, GITHUB_READ_INTEGRATION), tools: createGitHubReadTools(deps, agent, access) },
    { source: READ_AZURE_SOURCE, tools: createAzureTools(deps, agent, access) },
    { source: grantSource(agent, DEVHUB_INTEGRATION), tools: createDevHubTools(deps, agent, access).map(actingUnlessSaid) },
    { source: grantSource(agent, ADO_INTEGRATION), tools: createAdoTools(deps, agent, access, chatTestCaseTools) },
  ];

  return groups.map((group) => ({ ...group, tools: group.tools.map(withReadOnlyHint) }));
}

function withReadOnlyHint(tool: ToolDefinition<any>): ToolDefinition<any> {
  return { ...tool, annotations: tool.annotations ?? { readOnly: !WRITING_READERS.has(tool.name) } };
}

function actingUnlessSaid(tool: ToolDefinition<any>): ToolDefinition<any> {
  return { ...tool, annotations: tool.annotations ?? { readOnly: false } };
}

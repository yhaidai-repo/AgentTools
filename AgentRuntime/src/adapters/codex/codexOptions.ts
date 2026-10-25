import type { CodexOptions, ThreadOptions } from "@openai/codex-sdk";
import type { AgentRequest } from "../../models/AgentRequest";
import { codexInstructions } from "./codexToolNames";
import type { CodexToolServer } from "./CodexToolServer";

export function codexOptions(request: AgentRequest, codexHome: string, server: CodexToolServer): CodexOptions {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !/^(?:CODEX_|OPENAI_|ANTHROPIC_|CLAUDE_|POWERLOOM_CODEX_)/i.test(key))) as Record<string, string>;

  return {
    env: { ...env, CODEX_HOME: codexHome },
    config: {
      developer_instructions: codexInstructions(request.systemPrompt, request.tools),
      project_doc_max_bytes: 0,
      features: { shell_tool: false, multi_agent: false, hooks: false, memories: false, remote_plugin: false, apps: false, plugins: false, goals: false, view_image: false, computer_use: false, browser_use: false, image_generation: false, in_app_browser: false, workspace_dependencies: false, skill_search: false, sleep_tool: false },
      // The run's own tools, chosen by the host for this run: Codex would ask before any tool not marked read-only, and
      // with approval policy never that ask is a refusal ("MCP tool call requires approval"). Nobody answers in a run.
      mcp_servers: { agent: { url: server.url, http_headers: { Authorization: "Bearer " + server.token }, required: true, default_tools_approval_mode: "approve" } },
    },
  };
}

export function codexThreadOptions(request: AgentRequest, directory: string): ThreadOptions {
  return {
    model: request.model.model,
    modelReasoningEffort: request.model.effort,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    networkAccessEnabled: false,
    workingDirectory: directory,
    skipGitRepoCheck: true,
    webSearchMode: request.capabilities?.webAccess ? "live" : "disabled",
  };
}

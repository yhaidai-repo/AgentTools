import type { CodexOptions, ThreadOptions } from "@openai/codex-sdk";
import type { AgentRequest } from "../../models/AgentRequest";
import { codexInstructions } from "./codexToolNames";
import type { CodexToolServer } from "./CodexToolServer";

export function codexOptions(request: AgentRequest, codexHome: string, server: CodexToolServer): CodexOptions {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !/^(?:OPENAI_API_KEY|CODEX_API_KEY|CODEX_HOME)$/i.test(key))) as Record<string, string>;

  return {
    env: { ...env, CODEX_HOME: codexHome },
    config: {
      developer_instructions: codexInstructions(request.systemPrompt, request.tools),
      project_doc_max_bytes: 0,
      features: { shell_tool: false, multi_agent: false, hooks: false, memories: false, remote_plugin: false },
      mcp_servers: { agent: { url: server.url, http_headers: { Authorization: "Bearer " + server.token }, required: true } },
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

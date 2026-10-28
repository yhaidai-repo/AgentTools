import type { ToolDefinition } from "@agenttools/runtime";
import type { SessionOutput } from "@powerloom/sandbox";
import { z } from "zod";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import { defineOutsideTool } from "../outsideAccess";
import { refusalOf } from "./commandRefusals";
import type { RunSandbox } from "./models/RunSandbox";
import type { SandboxAccess } from "./models/SandboxAccess";
import { failure, noSandbox, resourceOf } from "./sandboxResults";

const DEFAULT_YIELD_MS = 10_000;
const MAX_YIELD_MS = 30_000;
const DEFAULT_OUTPUT_TOKENS = 10_000;
const MAX_OUTPUT_TOKENS = 25_000;
// Output is cut by characters; a token is about four.
const CHARS_PER_TOKEN = 4;
const REQUEST_CHARS = 500;
const STDIN_LOG_CHARS = 200;

// Sessions: a process in a terminal that keeps running between calls, shaped like Codex's exec_command and
// write_stdin. A shell started here keeps its folder and variables; a server started here can be called from another
// session (localhost works without a network).
export function createSessionTools(deps: AgentDeps, context: OutsideAccessContext, access: SandboxAccess, sandbox: RunSandbox): ToolDefinition<any>[] {
  return [execCommandTool(deps, context, access, sandbox), writeStdinTool(deps, context, access, sandbox)];
}

function execCommandTool(deps: AgentDeps, context: OutsideAccessContext, access: SandboxAccess, sandbox: RunSandbox) {
  return defineOutsideTool(deps.outside, context, {
    name: "exec_command",
    description: "Start a command in a terminal session in your sandbox. It answers with what the command printed within yield_time_ms, and either its exit code or the session id while it still runs; go on with write_stdin. Use it for a shell that keeps its state (cmd \"bash\"), a server, a watcher or anything interactive; run_command is simpler for a command that just runs to its end.",
    input: {
      cmd: z.string().min(1).describe("The command, run with bash -lc"),
      workdir: z.string().optional().describe("Folder to start in, under /workspace (default /workspace)"),
      yield_time_ms: z.number().int().min(0).max(MAX_YIELD_MS).optional().describe(`How long to wait for output before answering (default ${DEFAULT_YIELD_MS})`),
      max_output_tokens: z.number().int().min(100).max(MAX_OUTPUT_TOKENS).optional().describe(`Most output to return (default ${DEFAULT_OUTPUT_TOKENS} tokens)`),
    },
    resource: (input) => resourceOf(access, sandbox, input.workdir),
    request: (input) => input.cmd.slice(0, REQUEST_CHARS),
    handler: async (input) => {
      const refusal = refusalOf(input.cmd);

      if (refusal) {
        return { text: refusal, isError: true, refusal };
      }

      if (!sandbox.info) {
        return noSandbox();
      }

      const answer = await access.client.startSession(sandbox.info.id, { command: input.cmd, cwd: input.workdir, yieldMs: input.yield_time_ms ?? DEFAULT_YIELD_MS, maxChars: maxChars(input.max_output_tokens) });

      return answer.ok ? sessionText(answer.value) : failure(answer);
    },
  });
}

function writeStdinTool(deps: AgentDeps, context: OutsideAccessContext, access: SandboxAccess, sandbox: RunSandbox) {
  return defineOutsideTool(deps.outside, context, {
    name: "write_stdin",
    description: "Write to a running session's terminal and read what it printed since the last read. Empty chars only reads (poll a build or a server). \"\\u0003\" is Ctrl-C; end a line with \"\\n\". Never type a password or key here: what you write is logged.",
    input: {
      session_id: z.string().min(1).describe("The session id exec_command gave"),
      chars: z.string().describe("What to type; empty to only read"),
      yield_time_ms: z.number().int().min(0).max(MAX_YIELD_MS).optional().describe(`How long to wait for output before answering (default ${DEFAULT_YIELD_MS})`),
      max_output_tokens: z.number().int().min(100).max(MAX_OUTPUT_TOKENS).optional().describe(`Most output to return (default ${DEFAULT_OUTPUT_TOKENS} tokens)`),
    },
    resource: (input) => resourceOf(access, sandbox, `session ${input.session_id}`),
    request: (input) => `session ${input.session_id}: ${JSON.stringify(input.chars.slice(0, STDIN_LOG_CHARS))}`,
    handler: async (input) => {
      if (!sandbox.info) {
        return noSandbox();
      }

      const answer = await access.client.writeStdin(sandbox.info.id, input.session_id, { chars: input.chars, yieldMs: input.yield_time_ms ?? DEFAULT_YIELD_MS, maxChars: maxChars(input.max_output_tokens) });

      return answer.ok ? sessionText(answer.value) : failure(answer);
    },
  });
}

function maxChars(tokens: number | undefined): number {
  return (tokens ?? DEFAULT_OUTPUT_TOKENS) * CHARS_PER_TOKEN;
}

function sessionText(output: SessionOutput): OutsideToolResult {
  const status = output.running ? `Process running with session ID ${output.sessionId}` : `Process exited with code ${output.exitCode ?? "unknown"}`;

  return { text: `${status}\nOutput:\n${output.output}`, truncated: output.truncated };
}

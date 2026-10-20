import type { Query, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

// A run's first tool calls failed with "No such tool available" once the agent had ~60 tools (2026-10-20): the model
// answered before the SDK had connected our in-process tool server. With streamed input the first message can wait
// for the server; the SDK then ends the stream by itself after the turn (probe 2026-10-21).
const POLL_MS = 50;
const READY_TIMEOUT_MS = 10_000;

export async function waitForToolServer(query: Query, serverName: string, timeoutMs = READY_TIMEOUT_MS): Promise<"connected" | "timed-out" | "failed"> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await statusOf(query, serverName);

    if (status === "connected" || status === "failed") {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }

  return "timed-out";
}

// The first user message, sent once `ready` settles (whatever it settled to: a server that never connects still
// gets the message, and the run shows the tool errors).
export async function* firstMessageAfter(ready: Promise<unknown>, text: string): AsyncIterable<SDKUserMessage> {
  await ready.catch(() => undefined);

  yield { type: "user", message: { role: "user", content: text }, parent_tool_use_id: null, session_id: "" };
}

async function statusOf(query: Query, serverName: string): Promise<string> {
  try {
    const servers = await query.mcpServerStatus();

    return servers.find((server) => server.name === serverName)?.status ?? "pending";
  } catch {
    return "pending";
  }
}

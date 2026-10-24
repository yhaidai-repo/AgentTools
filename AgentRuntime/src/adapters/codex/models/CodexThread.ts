import type { ThreadEvent } from "@openai/codex-sdk";

export interface CodexThread {
  runStreamed(input: string, options: { signal: AbortSignal }): Promise<{ events: AsyncIterable<ThreadEvent> }>;
}

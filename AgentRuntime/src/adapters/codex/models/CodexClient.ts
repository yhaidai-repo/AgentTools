import type { ThreadOptions } from "@openai/codex-sdk";
import type { CodexThread } from "./CodexThread";

export interface CodexClient {
  startThread(options: ThreadOptions): CodexThread;
  resumeThread(id: string, options: ThreadOptions): CodexThread;
}

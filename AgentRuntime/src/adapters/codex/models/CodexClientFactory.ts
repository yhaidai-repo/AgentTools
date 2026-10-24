import type { CodexOptions } from "@openai/codex-sdk";
import type { CodexClient } from "./CodexClient";

export type CodexClientFactory = (options: CodexOptions) => CodexClient;

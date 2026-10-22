import type { ToolDefinition } from "@agenttools/runtime";
import type { ReadLog } from "../../evidence/ReadLog";
import type { WriterTarget } from "./WriterTarget";

// An output tool any agent can be granted (user decision 2026-10-22: writers are shared and granted like readers), with
// the commit that stores what it recorded once the run succeeds. Returns the ids it wrote, for the run's outputs.
export interface RunWriter {
  tools(log: ReadLog): ToolDefinition<any>[];
  commit(target: WriterTarget): Promise<string[]>;
}

import type { ToolDefinition } from "@agenttools/runtime";
import type { CommandContext } from "@powerloom/core";
import { commandToolName, createCommandTool } from "../commandTool";
import { liveTestCommands } from "./liveTestCommands";
import type { LiveTestScope } from "./LiveTestScope";

export const LIVE_TEST_INTEGRATION = "powerloomLiveTest";

/** The live test's command tools, reads and guarded writes apart (the reads go to the run's read log), without the
 *  names the run's toolset already has: two tools with one name break a run. */
export function liveTestTools(context: CommandContext, scope: LiveTestScope, taken: Set<string>): { reads: ToolDefinition<any>[]; writes: ToolDefinition<any>[] } {
  const tools = liveTestCommands(scope)
    .map((command) => ({ command, tool: createCommandTool(commandToolName(command.name), command, context) }))
    .filter(({ tool }) => !taken.has(tool.name));

  return {
    reads: tools.filter(({ command }) => command.effect === "read").map(({ tool }) => tool),
    writes: tools.filter(({ command }) => command.effect !== "read").map(({ tool }) => tool),
  };
}

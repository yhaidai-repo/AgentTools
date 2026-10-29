import type { CommandContext } from "@powerloom/core";
import { itemKindOf } from "./itemKindOf";

// A task is open to every enabled agent taking its type, which dispatches within minutes and would start a run and spend
// budget: a live test makes or reopens only tasks of a type no enabled agent takes. The agent it creates stays disabled,
// so it can take a type of its own.
export async function takenTypeProblem(context: CommandContext, type: string): Promise<string | null> {
  if (!context.agents) {
    return "the agent store isn't available, so it can't be checked that no enabled agent takes the task's type.";
  }

  const takers = (await context.agents.list()).filter((agent) => agent.enabled && agent.handles.includes(type));

  return takers.length === 0 ? null : `${takers.map((agent) => agent.id).join(", ")} would take a ${type} task and start a run: a live test uses a task type no enabled agent takes (create a disabled agent that handles a type of its own).`;
}

/** The same check for an existing task, by the type it has. */
export async function takenTypeProblemOfItem(context: CommandContext, itemId: string): Promise<string | null> {
  const type = await itemKindOf(context.db, itemId);

  return type === undefined ? null : takenTypeProblem(context, type);
}

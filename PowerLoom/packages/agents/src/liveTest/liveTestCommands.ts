import { COMMANDS, findCommand, type Command } from "@powerloom/core";
import { guardedCommand } from "./guardedCommand";
import { LIVE_TEST_RULES } from "./liveTestRules";
import type { LiveTestScope } from "./LiveTestScope";

/** What a live test may call: every read command, and the allowed writes behind the guard. */
export function liveTestCommands(scope: LiveTestScope): Command<any, any>[] {
  const reads = COMMANDS.filter((command) => command.effect === "read");
  const writes = LIVE_TEST_RULES.map((rule) => guardedCommand(commandNamed(rule.command), rule, scope));

  return [...reads, ...writes];
}

export function commandNamed(name: string): Command<any, any> {
  const command = findCommand(name);

  if (!command) {
    throw new Error(`live test: no command ${name}`);
  }

  return command;
}

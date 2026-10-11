import { z } from "zod";
import type { Command } from "../models/Command";
import type { CommandContext } from "../models/CommandContext";
import type { Outcome } from "../models/Outcome";

// Every caller goes through here, so input is validated the same way wherever it comes from (a form, an MCP tool call).
export async function runCommand<I, O>(command: Command<I, O>, context: CommandContext, input: unknown): Promise<Outcome<O>> {
  const parsed = command.input.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: `${command.name}: ${z.prettifyError(parsed.error)}` };
  }

  return command.run(context, parsed.data);
}

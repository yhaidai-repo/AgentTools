import type { z } from "zod";
import type { CommandContext } from "./CommandContext";
import type { CommandEffect } from "./CommandEffect";
import type { Outcome } from "./Outcome";

// One user action with a contract: a stable name, a description and a validated input. The web's actions and the MCP
// server run it, so each change or read happens in one place. Expected failures come back as Outcome errors.
export interface Command<I, O> {
  name: string;
  description: string;
  input: z.ZodType<I>;
  /** What the command does to PowerLoom; a plain write when left out (see CommandEffect). */
  effect?: CommandEffect;
  run(context: CommandContext, input: I): Promise<Outcome<O>>;
}

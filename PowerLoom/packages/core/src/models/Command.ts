import type { z } from "zod";
import type { CommandContext } from "./CommandContext";
import type { Outcome } from "./Outcome";

// One user action with a contract: a stable name, a description and a validated input. The web's actions run it today;
// an MCP server can list and expose the same commands as tools later. Expected failures come back as Outcome errors.
export interface Command<I, O> {
  name: string;
  description: string;
  input: z.ZodType<I>;
  run(context: CommandContext, input: I): Promise<Outcome<O>>;
}

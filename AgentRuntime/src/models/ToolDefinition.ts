import type { z } from "zod";
import type { ToolResult } from "./ToolResult";

// Provider-neutral tool; each runtime adapter converts it to its own format.
export interface ToolDefinition<Shape extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  description: string;
  input: Shape;
  handler: (input: z.infer<z.ZodObject<Shape>>) => Promise<ToolResult>;
  /** The tool only fills state the host keeps in memory until the run ends; a host continuing the conversation in a new
   *  run calls it again with the earlier inputs to rebuild that state. Tools that read, or write at once, leave it off. */
  replayOnResume?: boolean;
  /** Rebuilds in-memory state from an earlier call's input and result without running the tool again (e.g. a read's
   *  source id for evidence checks); a host continuing a conversation calls it for each earlier successful call. */
  restore?: (input: unknown, output: string) => void;
}

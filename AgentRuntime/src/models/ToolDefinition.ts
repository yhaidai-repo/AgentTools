import type { z } from "zod";
import type { ToolResult } from "./ToolResult";

// Provider-neutral tool; each runtime adapter converts it to its own format.
export interface ToolDefinition<Shape extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  description: string;
  input: Shape;
  handler: (input: z.infer<z.ZodObject<Shape>>) => Promise<ToolResult>;
}

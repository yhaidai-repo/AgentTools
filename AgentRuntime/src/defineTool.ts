import type { z } from "zod";
import type { ToolDefinition } from "./models/ToolDefinition";

// Identity helper so the handler's input type is inferred from the zod shape.
export function defineTool<Shape extends z.ZodRawShape>(definition: ToolDefinition<Shape>): ToolDefinition<Shape> {
  return definition;
}

import { z } from "zod";
import type { CommandInfo } from "../models/CommandInfo";
import { COMMANDS } from "./commandRegistry";

// What a caller needs to pick and call a command: its name, what it does and its input as JSON Schema (what a caller
// sends, before defaults and transforms).
export function describeCommands(): CommandInfo[] {
  return COMMANDS.map((command) => ({
    name: command.name,
    description: command.description,
    input: z.toJSONSchema(command.input, { io: "input", unrepresentable: "any" }),
  }));
}

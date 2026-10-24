import { z } from "zod";
import { USER_TASK_TYPES } from "../agentStages";

// What a new task and a schedule by task type share (the Tasks page's form), described once for both commands.
export const taskFields = {
  type: z.string().trim().min(1).describe(`The task type: ${USER_TASK_TYPES.join(", ")}, or a type an agent made on the Agents page handles (agent_list)`),
  title: z.string().trim().min(1).max(120).describe("What the agent should do, in one line"),
  description: z.string().trim().min(1).describe("What to do"),
  acceptanceCriteria: z.string().trim().min(1).describe("When it is done"),
  pbi: z.string().trim().min(1).nullable().default(null).describe("The PBI (id or ADO link): refinement, design and test need one; research and custom types read repos without one"),
  repos: z.array(z.string().trim().min(1)).default([]).describe("Repos to read when there is no PBI (list_repos)"),
};

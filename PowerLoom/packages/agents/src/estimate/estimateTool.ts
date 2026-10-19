import type { AgentDefinition } from "@agenttools/config";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { EstimateDraft } from "./models/EstimateDraft";
import type { RunEstimate } from "./RunEstimate";

type Input = z.infer<z.ZodObject<typeof INPUT>>;

export const ESTIMATE_INTEGRATION = "estimate";
export const ESTIMATE_TOOL = "record_estimate";

const INPUT = {
  human_hours: z.number().positive().describe("Hours a developer needs to implement the PBI without an agent: code, tests, review fixes"),
  agent_hours: z.number().positive().describe("Hours an agent needs to implement it, incl. running the tests; not waiting for review"),
  basis: z.string().min(1).describe("What drives the numbers: the areas that change, the unknowns, comparable work"),
  complexity: z.number().int().min(1).max(5).optional().describe("1 trivial, 2 small and local, 3 several files or one contract, 4 several components or a migration, 5 cross-system or unclear"),
  confidence: z.enum(["high", "medium", "low"]).optional().describe("high: every part checked in the code; medium: some parts inferred; low: key parts assumed"),
};

// The one way any agent estimates a PBI (user decision 2026-10-18): for an agent whose Config grants it, on a task with a
// PBI. Every estimate carries both values; pages show the PBI's latest estimate from any agent.
export function offersEstimate(agent: AgentDefinition, pbiId: number | null): boolean {
  return agent.capabilities.integrations?.[ESTIMATE_INTEGRATION] === true && pbiId !== null;
}

export function createEstimateTools(estimate: RunEstimate): ToolDefinition<any>[] {
  return estimate.isOffered ? [estimateTool(estimate)] : [];
}

function estimateTool(estimate: RunEstimate) {
  return defineTool({
    name: ESTIMATE_TOOL,
    description: "Record your estimate of implementing the PBI, always both values: a developer without an agent, and an agent. Call again to replace it. The PBI shows the latest estimate any agent recorded; it stays in PowerLoom, never in Azure DevOps.",
    input: INPUT,
    handler: async (input: Input) => {
      const draft = toDraft(input);

      estimate.record(draft);

      return { text: `Estimate recorded: ${draft.humanHours} h human, ${draft.agentHours} h agent.` };
    },
    replayOnResume: true,
  });
}

function toDraft(input: Input): EstimateDraft {
  return {
    humanHours: input.human_hours,
    agentHours: input.agent_hours,
    complexity: input.complexity ?? null,
    confidence: input.confidence ?? null,
    basis: input.basis,
  };
}

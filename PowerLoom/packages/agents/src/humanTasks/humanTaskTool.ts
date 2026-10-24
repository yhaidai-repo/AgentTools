import { MAX_REASON_CHARS, QUERY_SOURCES, sourceLabel, type HumanTaskData, type HumanTaskStep } from "@powerloom/core";
import { defineTool } from "@agenttools/runtime";
import { z } from "zod";
import type { HumanTaskSpec } from "./models/HumanTaskSpec";

type ToolText = { text: string; isError?: boolean };

const SOURCES = ["app-insights", "log-analytics", "cosmos", "sql", "portal", "ado", "other"] as const;

export const reasonInput = (what: string) => z.string().min(1).max(MAX_REASON_CHARS).describe(`${what}; at most 2 short sentences`);

export const stepInput = z.object({
  action: z.string().min(1).describe("What to do, as an instruction"),
  source: z.enum(SOURCES).describe("Where it is done"),
  resource: z.string().min(1).describe("The exact resource and environment, e.g. 'App Insights aa-stage-signals-service (stage)'"),
  query: z.object({
    language: z.enum(["kql", "cosmos-sql", "sql"]),
    text: z.string().min(1).describe("Runs as written: real names and ids, no placeholders"),
  }).nullable().default(null).describe(`Required for ${QUERY_SOURCES.join(", ")} steps`),
  timeRange: z.string().nullable().default(null).describe("e.g. 'last 30 days'; also inside the query"),
  reportBack: z.string().min(1).describe("What the person pastes back"),
});

// The one human-task tool every agent gets (user decision 2026-10-05): a short why and what it solves, then steps; a
// step that reads logs or data must bring its query. The caller decides what happens with an accepted task.
export function createHumanTaskTool(name: string, description: string, accept: (spec: HumanTaskSpec) => ToolText) {
  return defineTool({
    name,
    description: `${description} Say in short why a person must do it and which problem the answer solves; give each step its resource, and a ready-to-run query for logs and data (KQL for App Insights / Log Analytics, SQL for Cosmos and databases).`,
    input: {
      title: z.string().min(1).max(120),
      why: reasonInput("Why a person must do it: what you can't see or do yourself"),
      solves: reasonInput("Which problem or decision the answer settles"),
      steps: z.array(stepInput).min(1),
    },
    handler: async (input) => {
      const data: HumanTaskData = { why: input.why, solves: input.solves, steps: input.steps };
      const problem = missingQueryProblem(data.steps);

      if (problem) {
        return { text: `Not noted: ${problem}`, isError: true };
      }

      return accept({ title: input.title, data });
    },
  });
}

// A step that reads logs or data must bring the query a person runs as written.
export function missingQueryProblem(steps: HumanTaskStep[]): string | null {
  const missing = steps.map((step, index) => ({ step, index })).filter(({ step }) => QUERY_SOURCES.includes(step.source) && !step.query);

  if (missing.length === 0) {
    return null;
  }

  return `step(s) ${missing.map(({ step, index }) => `${index + 1} (${sourceLabel(step.source)})`).join(", ")} read logs or data; give each the query to run.`;
}

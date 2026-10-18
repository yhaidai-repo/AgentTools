import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import { estimateText } from "@powerloom/core";
import type { pbiEstimate } from "@powerloom/db";
import { z } from "zod";
import { AGENT_DEFAULTS } from "../agentDefaults";
import type { RefinementOutput } from "../refinement/models/RefinementOutput";
import { hasRefinementOutput } from "../refinement/hasRefinementOutput";
import { ESTIMATE_INTEGRATION, ESTIMATE_TOOL, createEstimateTools, offersEstimate } from "./estimateTool";
import { RunEstimate } from "./RunEstimate";

const PBI = 36756;

const refinement = { summary: "The vendor shows as a raw key." } as RefinementOutput;

function agentWith(estimate: boolean | undefined): AgentDefinition {
  const integrations = estimate === undefined ? {} : { [ESTIMATE_INTEGRATION]: estimate };

  return { capabilities: { webAccess: false, integrations } } as unknown as AgentDefinition;
}

function offeredTool() {
  const estimate = new RunEstimate(true);
  const [tool] = createEstimateTools(estimate);

  return { estimate, tool };
}

function estimateInput(overrides: Record<string, unknown> = {}) {
  return { human_hours: 6, agent_hours: 1.5, basis: "one report column; the premise check may add a data fix", ...overrides };
}

describe("offersEstimate", () => {
  it("offers record_estimate only to an agent whose Config grants it, on a PBI", () => {
    assert.equal(offersEstimate(agentWith(true), PBI), true);
    assert.equal(offersEstimate(agentWith(false), PBI), false);
    assert.equal(offersEstimate(agentWith(undefined), PBI), false);
    assert.equal(offersEstimate(agentWith(true), null), false);
  });
});

describe("createEstimateTools", () => {
  it("gives no tool when the run isn't offered it", () => {
    assert.equal(createEstimateTools(new RunEstimate(false)).length, 0);
  });

  it("gives record_estimate when it is", () => {
    const { tool } = offeredTool();

    assert.equal(tool.name, ESTIMATE_TOOL);
  });
});

describe("record_estimate", () => {
  it("requires both values and a basis, each positive", () => {
    const input = z.object(offeredTool().tool.input);

    assert.equal(input.safeParse(estimateInput()).success, true);
    assert.equal(input.safeParse(estimateInput({ agent_hours: undefined })).success, false);
    assert.equal(input.safeParse(estimateInput({ human_hours: undefined })).success, false);
    assert.equal(input.safeParse(estimateInput({ basis: "" })).success, false);
    assert.equal(input.safeParse(estimateInput({ human_hours: 0 })).success, false);
    assert.equal(input.safeParse(estimateInput({ agent_hours: -1 })).success, false);
  });

  it("takes complexity 1–5 and a confidence as options", () => {
    const input = z.object(offeredTool().tool.input);

    assert.equal(input.safeParse(estimateInput({ complexity: 3, confidence: "medium" })).success, true);
    assert.equal(input.safeParse(estimateInput({ complexity: 6 })).success, false);
    assert.equal(input.safeParse(estimateInput({ confidence: "sure" })).success, false);
  });

  it("records both values, and nulls for the options left out", async () => {
    const { estimate, tool } = offeredTool();

    const result = await tool.handler(estimateInput());

    assert.equal(result.text, "Estimate recorded: 6 h human, 1.5 h agent.");
    assert.deepEqual(estimate.latest, { humanHours: 6, agentHours: 1.5, complexity: null, confidence: null, basis: "one report column; the premise check may add a data fix" });
  });

  it("replaces the run's estimate on a second call", async () => {
    const { estimate, tool } = offeredTool();

    await tool.handler(estimateInput());
    await tool.handler(estimateInput({ human_hours: 10, agent_hours: 3, complexity: 4, confidence: "low" }));

    assert.deepEqual({ human: estimate.latest?.humanHours, agent: estimate.latest?.agentHours, complexity: estimate.latest?.complexity }, { human: 10, agent: 3, complexity: 4 });
  });
});

describe("hasRefinementOutput", () => {
  it("needs the estimate when the run is offered record_estimate", async () => {
    const { estimate, tool } = offeredTool();

    assert.equal(hasRefinementOutput(refinement, estimate), false);

    await tool.handler(estimateInput());

    assert.equal(hasRefinementOutput(refinement, estimate), true);
  });

  it("needs only the refinement when the Config doesn't grant estimates", () => {
    assert.equal(hasRefinementOutput(refinement, new RunEstimate(false)), true);
    assert.equal(hasRefinementOutput(null, new RunEstimate(false)), false);
  });
});

describe("estimateText", () => {
  it("shows both values and who gave them, for read_pbi's reference line", () => {
    const row = { id: 1, pbiId: PBI, runId: 41, agent: "design", humanHours: "12", agentHours: "3.5", complexity: 3, confidence: "medium", basis: "two services", createdAt: new Date() } as typeof pbiEstimate.$inferSelect;

    assert.equal(estimateText(row), "12 h human, 3.5 h agent (design, RUN-41)");
    assert.equal(estimateText({ ...row, agent: "refinement", agentHours: null, runId: null }), "12 h human, agent h not given (refinement)");
  });
});

describe("estimate grant defaults", () => {
  it("is on for the refinement agents and design, off for the others", () => {
    const granted = AGENT_DEFAULTS.filter((agent) => agent.capabilities.integrations?.[ESTIMATE_INTEGRATION] === true).map((agent) => agent.id);
    const offered = AGENT_DEFAULTS.every((agent) => agent.integrationSpecs?.some((spec) => spec.key === ESTIMATE_INTEGRATION));

    assert.deepEqual(granted, ["refinement", "better-refinement", "design"]);
    assert.equal(offered, true);
  });
});

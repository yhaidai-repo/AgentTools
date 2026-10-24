import { validateAgent, type AgentDefinition } from "@agenttools/config";
import { agentPromptVersion } from "@powerloom/db";
import { z } from "zod";
import { TASK_TYPE_PATTERN } from "../tasks/customTaskTypes";
import { newAgentTemplate } from "../agents/newAgentTemplate";
import type { Command } from "../models/Command";
import type { CommandContext } from "../models/CommandContext";
import type { CreateAgentInput } from "../models/CreateAgentInput";
import type { Outcome } from "../models/Outcome";

const AGENT_ID = /^[a-z][a-z0-9-]*$/;
const CRON = /^(\S+\s+){4}\S+$/;
// A built-in task type or a new one the agent brings (user decision 2026-10-24).
const TASK_TYPE = z.string().trim().regex(TASK_TYPE_PATTERN, "a task type: lower-case letters, digits and dashes");

// An agent made from a description (user decision 2026-10-23): its prompt, skills and task types on the template's
// defaults, saved disabled unless asked otherwise; it runs on the generic executor. The caller has asked the user what the
// agent is for before; this command validates and saves.
export const createAgentCommand: Command<CreateAgentInput, { id: string; promptVersion: number; enabled: boolean }> = {
  name: "agent.create",
  description: "Create a PowerLoom agent that runs on the generic executor: id, label, the one-line description for the Agents page, its prompt ({{framework}} inserts the shared framework; {{team}} and {{agent}} are filled per run), the task types it takes, the skills it may load (existing names; make one with skill_create first), the task types it may hand on, its grants (integration keys such as readRepos, readSql, writeNotes), and optionally model, limits, budgets, a cron schedule and enabled. Ask first what the agent's goal is, what it reads, what it produces, and which tasks it should take.",
  input: z.object({
    id: z.string().trim().regex(AGENT_ID, "lower-case letters, digits and dashes").max(60),
    label: z.string().trim().min(1).max(80),
    description: z.string().trim().max(300).default(""),
    prompt: z.string().trim().min(20),
    handles: z.array(TASK_TYPE).min(1),
    skills: z.array(z.string().trim().min(1)).default([]),
    canAssign: z.array(TASK_TYPE).default([]),
    waitFor: z.array(z.string().trim().min(1)).default([]),
    grants: z.array(z.string().trim().min(1)).default([]),
    webAccess: z.boolean().default(false),
    model: z.object({ provider: z.string().min(1), model: z.string().min(1), effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional() }).nullable().default(null),
    limits: z.object({ maxTurns: z.number().int().min(1), timeoutMinutes: z.number().int().min(1) }).nullable().default(null),
    budgets: z.object({ perRunUsd: z.number().min(0), dailyUsd: z.number().min(0) }).nullable().default(null),
    schedule: z.string().trim().regex(CRON, "cron needs 5 fields").nullable().default(null),
    enabled: z.boolean().default(false),
    options: z.record(z.string(), z.number()).default({}),
  }),
  async run(context, input) {
    const agents = context.agents;

    if (!agents) {
      return { ok: false, error: "Agents can't be created from here (no agent store)." };
    }

    if (await agents.get(input.id)) {
      return { ok: false, error: `An agent with the id "${input.id}" exists.` };
    }

    const problems = await inputProblems(context, input);

    if (problems.length > 0) {
      return { ok: false, error: problems.join(" ") };
    }

    const definition = await buildDefinition(agents, input);
    const checked = validateAgent(definition);

    if (!checked.ok) {
      return { ok: false, error: checked.errors.join("; ") };
    }

    await agents.save(checked.value);
    await context.db.insert(agentPromptVersion).values({ agentId: input.id, version: 1, text: input.prompt });

    return { ok: true, value: { id: input.id, promptVersion: 1, enabled: input.enabled } };
  },
};

async function inputProblems(context: CommandContext, input: CreateAgentInput): Promise<string[]> {
  const known = await context.skills.names();
  const unknownSkills = input.skills.filter((skill) => !known.includes(skill));
  const template = await newAgentTemplate(context.agents!, input.id);
  const offered = (template.integrationSpecs ?? []).map((spec) => spec.key);
  const unknownGrants = input.grants.filter((grant) => !offered.includes(grant));

  return [
    ...(unknownSkills.length > 0 ? [`Unknown skills: ${unknownSkills.join(", ")} (known: ${known.join(", ")}).`] : []),
    ...(unknownGrants.length > 0 ? [`Unknown grants: ${unknownGrants.join(", ")} (offered: ${offered.join(", ")}).`] : []),
  ];
}

async function buildDefinition(agents: NonNullable<CommandContext["agents"]>, input: CreateAgentInput): Promise<AgentDefinition> {
  const template = await newAgentTemplate(agents, input.id);
  const integrations = Object.fromEntries(Object.keys(template.capabilities.integrations ?? {}).map((key) => [key, input.grants.includes(key)]));

  return {
    ...template,
    label: input.label,
    description: input.description,
    enabled: input.enabled,
    schedule: input.schedule,
    model: input.model ?? template.model,
    limits: input.limits ?? template.limits,
    budgets: input.budgets ?? template.budgets,
    capabilities: { webAccess: input.webAccess, integrations },
    skills: input.skills,
    prompt: input.prompt.replace(/\r\n/g, "\n"),
    promptVersion: 1,
    canAssign: input.canAssign,
    waitFor: input.waitFor,
    handles: input.handles,
    options: { ...template.options, ...input.options },
  };
}

export type CreateAgentOutcome = Outcome<{ id: string; promptVersion: number; enabled: boolean }>;

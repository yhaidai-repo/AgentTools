import { validateAgent, type AgentDefinition } from "@agenttools/config";
import { z } from "zod";
import { AGENT_TASK_TYPES } from "../agentStages";
import { insertPromptVersion } from "../agents/promptVersions";
import { withPromptVersion } from "../agents/promptVersioning";
import type { Command } from "../models/Command";
import type { CommandContext } from "../models/CommandContext";
import type { UpdateAgentInput } from "../models/UpdateAgentInput";

const CRON = /^(\S+\s+){4}\S+$/;
const TASK_TYPE = z.enum(AGENT_TASK_TYPES as [string, ...string[]]);

const input = z.object({
  id: z.string().trim().min(1).describe("The agent's id, e.g. better-research (agent.list)"),
  label: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  enabled: z.boolean().optional(),
  schedule: z.string().trim().regex(CRON, "cron needs 5 fields").nullable().optional().describe("A cron (5 fields), or null for manual runs only"),
  model: z.object({ provider: z.string().min(1), model: z.string().min(1), effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional() }).optional(),
  limits: z.object({ maxTurns: z.number().int().min(1), timeoutMinutes: z.number().int().min(1) }).optional(),
  budgets: z.object({ perRunUsd: z.number().min(0), dailyUsd: z.number().min(0) }).optional(),
  webAccess: z.boolean().optional(),
  grants: z.array(z.string().trim().min(1)).optional().describe("The integrations switched on (keys as agent.get lists them); every other one goes off"),
  skills: z.array(z.string().trim().min(1)).optional(),
  options: z.record(z.string(), z.number()).optional().describe("Option values, merged over the current ones (keys as agent.get lists them)"),
  canAssign: z.array(TASK_TYPE).optional(),
  handles: z.array(TASK_TYPE).optional(),
  waitFor: z.array(z.string().trim().min(1)).optional(),
  prompt: z.string().optional().describe("The whole prompt; a text equal to the shipped file puts the agent back on the file"),
});

// The Config page's save as a command (stage 2 of the powerloom-mcp design, 2026-10-24): only the fields given
// change, AgentConfig validates the whole definition, and a changed prompt is a new stored version.
export const updateAgentCommand: Command<UpdateAgentInput, { id: string; promptVersion: number; enabled: boolean; changed: string[] }> = {
  name: "agent.update",
  description: "Change an existing agent's Config: label, description, enabled, cron schedule, model, limits, budgets, web access, grants (integration keys), skills, options, task types it takes or hands on, what it waits for, and its prompt (every edit is a new stored version; the shipped file's text puts it back on the file). Only the fields given change. Read it with agent.get first. Change only what the user asked for and show the new values before calling, as the Config page's form does.",
  input,
  async run(context, input) {
    const agents = context.agents;

    if (!agents) {
      return { ok: false, error: "Agents can't be changed from here (no agent store)." };
    }

    const current = await agents.get(input.id);

    if (!current) {
      return { ok: false, error: `No agent ${input.id} (agent.list names them).` };
    }

    const problems = await inputProblems(context, current, input);

    if (problems.length > 0) {
      return { ok: false, error: problems.join(" ") };
    }

    const checked = validateAgent(await withPromptVersion(applyChanges(current, input), current));

    if (!checked.ok) {
      return { ok: false, error: checked.errors.join("; ") };
    }

    await save(context, current, checked.value);

    return { ok: true, value: { id: checked.value.id, promptVersion: checked.value.promptVersion ?? 0, enabled: checked.value.enabled, changed: changedFields(input) } };
  },
};

async function inputProblems(context: CommandContext, current: AgentDefinition, input: UpdateAgentInput): Promise<string[]> {
  const known = await context.skills.names();
  const unknownSkills = (input.skills ?? []).filter((skill) => !known.includes(skill));
  const offered = (current.integrationSpecs ?? []).map((spec) => spec.key);
  const unknownGrants = (input.grants ?? []).filter((grant) => !offered.includes(grant));
  const declared = current.optionSpecs.map((spec) => spec.key);
  const unknownOptions = Object.keys(input.options ?? {}).filter((key) => !declared.includes(key));

  return [
    ...(unknownSkills.length > 0 ? [`Unknown skills: ${unknownSkills.join(", ")} (known: ${known.join(", ")}).`] : []),
    ...(unknownGrants.length > 0 ? [`Unknown grants: ${unknownGrants.join(", ")} (offered: ${offered.join(", ")}).`] : []),
    ...(unknownOptions.length > 0 ? [`Unknown options: ${unknownOptions.join(", ")} (declared: ${declared.join(", ")}).`] : []),
  ];
}

// The fields given replace the current ones; grants rewrite every declared integration switch; options merge.
function applyChanges(current: AgentDefinition, input: UpdateAgentInput): AgentDefinition {
  const integrations = input.grants === undefined ? current.capabilities.integrations : Object.fromEntries((current.integrationSpecs ?? []).map((spec) => [spec.key, input.grants!.includes(spec.key)]));

  return {
    ...current,
    label: input.label ?? current.label,
    description: input.description ?? current.description,
    enabled: input.enabled ?? current.enabled,
    schedule: input.schedule === undefined ? current.schedule : input.schedule,
    model: input.model ?? current.model,
    limits: input.limits ?? current.limits,
    budgets: input.budgets ?? current.budgets,
    capabilities: { webAccess: input.webAccess ?? current.capabilities.webAccess, integrations },
    skills: input.skills ?? current.skills,
    options: { ...current.options, ...(input.options ?? {}) },
    canAssign: input.canAssign ?? current.canAssign,
    handles: input.handles ?? current.handles,
    waitFor: input.waitFor ?? current.waitFor,
    prompt: input.prompt ?? current.prompt ?? "",
  };
}

async function save(context: CommandContext, current: AgentDefinition, next: AgentDefinition): Promise<void> {
  if (next.promptVersion !== (current.promptVersion ?? 0)) {
    await insertPromptVersion(context.db, next.id, next.promptVersion ?? 0, next.prompt ?? "");
  }

  await context.agents!.save(next);
}

function changedFields(input: UpdateAgentInput): string[] {
  return Object.keys(input).filter((key) => key !== "id" && input[key as keyof UpdateAgentInput] !== undefined);
}

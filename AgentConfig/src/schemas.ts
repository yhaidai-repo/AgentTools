import { z } from "zod";
import type { AgentDefinition } from "./models/AgentDefinition";
import type { AgentOptionSpec } from "./models/AgentOptionSpec";
import type { AgentOptionValue } from "./models/AgentOptionValue";
import type { AgentsGlobal } from "./models/AgentsGlobal";
import type { ValidationResult } from "./models/ValidationResult";

const CRON = /^(\S+\s+){4}\S+$/;

// Shared by every store and client, so all of them accept and reject the same input.
export const agentDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, "lower-case id, e.g. refinement"),
  label: z.string().min(1),
  description: z.string(),
  enabled: z.boolean(),
  schedule: z.string().regex(CRON, "cron needs 5 fields").nullable(),
  model: z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional(),
  }),
  limits: z.object({
    maxTurns: z.number().int().positive(),
    timeoutMinutes: z.number().int().positive(),
  }),
  budgets: z.object({
    perRunUsd: z.number().nonnegative(),
    dailyUsd: z.number().nonnegative(),
  }),
  capabilities: z.object({ webAccess: z.boolean(), integrations: z.record(z.string(), z.boolean()).default({}) }),
  skills: z.array(z.string().min(1)),
  // The agent's own instructions (user decision 2026-10-22); empty = the prompt file shipped with the code, if any.
  prompt: z.string().default(""),
  // builtin: shipped in code (kept by ensureDefaults, never deleted); user: created in the UI (user decision 2026-10-22).
  origin: z.enum(["builtin", "user"]).default("builtin"),
  options: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  canAssign: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/, "a task type")).default([]),
  handles: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/, "a task type")).default([]),
  waitFor: z.array(z.string().min(1)),
  optionSpecs: z.array(z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    description: z.string(),
    min: z.number(),
    max: z.number(),
  })),
  integrationSpecs: z.array(z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    description: z.string(),
  })).default([]),
}).superRefine(checkOptions).superRefine(checkIntegrations);

export const agentsGlobalSchema = z.object({
  paused: z.boolean(),
  pausedUntil: z.string().datetime().nullable(),
  dailyBudgetUsd: z.number().nonnegative(),
});

// An option the code doesn't read would be saved and silently ignored, so it is rejected instead.
function checkOptions(agent: Pick<AgentDefinition, "options" | "optionSpecs">, context: z.RefinementCtx): void {
  const specs = new Map(agent.optionSpecs.map((spec) => [spec.key, spec]));
  const problems = Object.entries(agent.options).map(([key, value]) => ({ key, message: optionProblem(specs.get(key), value) }));

  problems
    .filter((problem) => problem.message !== null)
    .forEach((problem) => context.addIssue({ code: "custom", path: ["options", problem.key], message: problem.message! }));
}

// Same reason: an integration the host doesn't offer would be switched on and silently do nothing.
function checkIntegrations(agent: Pick<AgentDefinition, "capabilities" | "integrationSpecs">, context: z.RefinementCtx): void {
  const declared = new Set(agent.integrationSpecs.map((spec) => spec.key));

  Object.keys(agent.capabilities.integrations)
    .filter((key) => !declared.has(key))
    .forEach((key) => context.addIssue({ code: "custom", path: ["capabilities", "integrations", key], message: "unknown integration: the host doesn't offer it" }));
}

function optionProblem(spec: AgentOptionSpec | undefined, value: AgentOptionValue): string | null {
  if (!spec) {
    return "unknown option: the agent doesn't read it";
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "must be a number";
  }

  return value < spec.min || value > spec.max ? `must be between ${spec.min} and ${spec.max}` : null;
}

export function validateAgent(input: unknown): ValidationResult<AgentDefinition> {
  return toResult(agentDefinitionSchema.safeParse(input));
}

export function validateGlobal(input: unknown): ValidationResult<AgentsGlobal> {
  return toResult(agentsGlobalSchema.safeParse(input));
}

function toResult<T>(parsed: z.ZodSafeParseResult<T>): ValidationResult<T> {
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }

  return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`) };
}

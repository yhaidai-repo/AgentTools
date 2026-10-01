import { z } from "zod";
import type { AgentDefinition } from "./models/AgentDefinition";
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
  capabilities: z.object({ webAccess: z.boolean() }),
  skills: z.array(z.string().min(1)),
  options: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

export const agentsGlobalSchema = z.object({
  paused: z.boolean(),
  pausedUntil: z.string().datetime().nullable(),
  dailyBudgetUsd: z.number().nonnegative(),
});

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

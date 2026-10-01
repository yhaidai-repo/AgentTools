"use server";

import { validateAgent, validateGlobal, type AgentDefinition, type AgentOptionValue } from "@agenttools/config";
import { revalidatePath } from "next/cache";
import { getAgentConfig } from "@/lib/agentConfig";
import type { ActionResult } from "@/models/ActionResult";

// Saves through AgentConfig only; the agent-runner is notified and reschedules by itself.
export async function saveAgentAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const store = getAgentConfig();
  const current = await store.get(text(form, "id"));

  if (!current) {
    return { ok: false, message: "Unknown agent." };
  }

  const checked = validateAgent(readAgentForm(form, current));

  if (!checked.ok) {
    return { ok: false, message: checked.errors.join("; ") };
  }

  await store.save(checked.value);
  revalidatePath("/agents");
  revalidatePath(`/agents/${checked.value.id}/config`);

  return { ok: true, message: `${checked.value.label} saved. The agent-runner applies it right away.` };
}

export async function saveGlobalAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const store = getAgentConfig();
  const checked = validateGlobal({ ...(await store.getGlobal()), dailyBudgetUsd: Number(text(form, "dailyBudgetUsd")) });

  if (!checked.ok) {
    return { ok: false, message: checked.errors.join("; ") };
  }

  await store.saveGlobal(checked.value);
  revalidatePath("/settings");

  return { ok: true, message: "Saved." };
}

function readAgentForm(form: FormData, current: AgentDefinition): AgentDefinition {
  const effort = text(form, "effort");

  return {
    ...current,
    enabled: form.get("enabled") === "on",
    schedule: text(form, "schedule") || null,
    model: { provider: text(form, "provider"), model: text(form, "model"), ...(effort ? { effort: effort as AgentDefinition["model"]["effort"] } : {}) },
    limits: { maxTurns: Number(text(form, "maxTurns")), timeoutMinutes: Number(text(form, "timeoutMinutes")) },
    budgets: { perRunUsd: Number(text(form, "perRunUsd")), dailyUsd: Number(text(form, "dailyUsd")) },
    capabilities: { webAccess: form.get("webAccess") === "on" },
    skills: text(form, "skills").split(",").map((skill) => skill.trim()).filter(Boolean),
    options: readOptions(text(form, "options"), current.options),
  };
}

// "key = value" per line; numbers and true/false keep their type.
function readOptions(raw: string, current: Record<string, AgentOptionValue>): Record<string, AgentOptionValue> {
  const entries = raw.split("\n").map((line) => line.split("=").map((part) => part.trim())).filter(([key]) => key);

  return entries.length > 0 ? Object.fromEntries(entries.map(([key, value]) => [key, parseOption(value ?? "")])) : current;
}

function parseOption(value: string): AgentOptionValue {
  if (value === "true" || value === "false") {
    return value === "true";
  }

  return value !== "" && Number.isFinite(Number(value)) ? Number(value) : value;
}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

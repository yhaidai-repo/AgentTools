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
    skills: form.getAll("skills").map(String),
    options: readOptions(form, current),
    next: text(form, "next") || null,
    waitFor: form.getAll("waitFor").map(String),
  };
}

// One field per declared option (`option:<key>`); AgentConfig checks the ranges.
function readOptions(form: FormData, current: AgentDefinition): Record<string, AgentOptionValue> {
  return Object.fromEntries(current.optionSpecs.map((spec) => [spec.key, Number(text(form, `option:${spec.key}`))]));
}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

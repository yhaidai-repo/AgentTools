"use server";

import { isRemovable, validateAgent, validateGlobal, type AgentDefinition, type AgentOptionValue } from "@agenttools/config";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

// A new agent is a copy of an existing one under its own id (user decision 2026-10-22), disabled and without a schedule
// until configured; with or without the source's prompt and skills. It runs on the generic executor.
export async function createAgentAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const store = getAgentConfig();
  const id = text(form, "id");
  const base = await store.get(text(form, "basedOn"));

  if (!base) {
    return { ok: false, message: "Choose the agent to base it on." };
  }

  if (await store.get(id)) {
    return { ok: false, message: `An agent with the id "${id}" exists.` };
  }

  const checked = validateAgent(copiedAgent(base, form));

  if (!checked.ok) {
    return { ok: false, message: checked.errors.join("; ") };
  }

  await store.save(checked.value);
  revalidatePath("/agents");
  redirect(`/agents/${checked.value.id}/config`);
}

export async function deleteAgentAction(id: string): Promise<ActionResult> {
  const store = getAgentConfig();
  const agent = await store.get(id);

  if (!agent) {
    return { ok: false, message: "Unknown agent." };
  }

  if (!isRemovable(agent)) {
    return { ok: false, message: "This agent is shipped with the code and can't be deleted." };
  }

  await store.remove(id);
  revalidatePath("/agents");
  redirect("/agents");
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
    capabilities: { webAccess: form.get("webAccess") === "on", integrations: readIntegrations(form, current) },
    skills: form.getAll("skills").map(String),
    prompt: text(form, "prompt"),
    options: readOptions(form, current),
    canAssign: form.getAll("canAssign").map(String),
    handles: form.getAll("handles").map(String),
    waitFor: form.getAll("waitFor").map(String),
  };
}

// One field per declared option (`option:<key>`); AgentConfig checks the ranges.
function readOptions(form: FormData, current: AgentDefinition): Record<string, AgentOptionValue> {
  return Object.fromEntries(current.optionSpecs.map((spec) => [spec.key, Number(text(form, `option:${spec.key}`))]));
}

// One checkbox per integration the host declares (`integration:<key>`); undeclared keys never reach the definition.
function readIntegrations(form: FormData, current: AgentDefinition): Record<string, boolean> {
  return Object.fromEntries((current.integrationSpecs ?? []).map((spec) => [spec.key, form.get(`integration:${spec.key}`) === "on"]));
}

function copiedAgent(base: AgentDefinition, form: FormData): AgentDefinition {
  const copyInstructions = form.get("copyInstructions") === "on";

  return {
    ...base,
    id: text(form, "id"),
    label: text(form, "label"),
    description: text(form, "description"),
    enabled: false,
    schedule: null,
    prompt: copyInstructions ? (base.prompt ?? "") : "",
    skills: copyInstructions ? base.skills : [],
    origin: "user",
  };
}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

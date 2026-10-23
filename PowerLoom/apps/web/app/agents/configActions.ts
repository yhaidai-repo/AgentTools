"use server";

import type { AgentDefinition, AgentOptionValue } from "@agenttools/config";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAgentCommand, createSkillCommand, deleteAgentCommand, newAgentTemplate, saveAgentsGlobalCommand, updateAgentCommand, type UpdateAgentInput } from "@powerloom/core";
import { getAgentConfig } from "@/lib/agentConfig";
import { runWebCommand } from "@/lib/commandContext";
import type { ActionResult } from "@/models/ActionResult";

// The Config page's save runs agent.update (the command a chat uses too): the whole form, prompt versioning and
// validation inside the command; the agent-runner is notified and reschedules by itself.
export async function saveAgentAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const current = await getAgentConfig().get(text(form, "id"));

  if (!current) {
    return { ok: false, message: "Unknown agent." };
  }

  const saved = await runWebCommand(updateAgentCommand, updateInputFromForm(form, current));

  if (!saved.ok) {
    return { ok: false, message: saved.error };
  }

  revalidatePath("/agents");
  revalidatePath(`/agents/${saved.value.id}/config`);

  return { ok: true, message: `${current.label} saved. The agent-runner applies it right away.` };
}

// A new agent (user decision 2026-10-23): its prompt (saved as version 1), the skills it may load (a new one written
// with it), the task types it takes, and the template's defaults for the rest, changed under Advanced; disabled and
// without a schedule until configured. It runs on the generic executor.
export async function createAgentAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const skill = await createNewSkill(form);

  if (skill && !skill.ok) {
    return skill;
  }

  const template = await newAgentTemplate(getAgentConfig(), text(form, "id"));
  const advanced = readAgentForm(form, template);
  const created = await runWebCommand(createAgentCommand, {
    id: text(form, "id"),
    label: text(form, "label"),
    description: text(form, "description"),
    prompt: text(form, "prompt"),
    handles: form.getAll("handles").map(String),
    skills: [...form.getAll("skills").map(String), ...(skill ? [skill.message] : [])],
    canAssign: [],
    grants: grantsOf(advanced),
    webAccess: advanced.capabilities.webAccess,
    model: advanced.model,
    limits: advanced.limits,
    budgets: advanced.budgets,
    schedule: null,
    enabled: false,
    options: numberOptions(advanced),
  });

  if (!created.ok) {
    return { ok: false, message: created.error };
  }

  revalidatePath("/agents");
  redirect(`/agents/${created.value.id}/config`);
}

// The skill the form wrote, through the same command a chat uses; `message` carries its name when it is ok.
async function createNewSkill(form: FormData): Promise<ActionResult | null> {
  const name = text(form, "newSkillName");

  if (!name) {
    return null;
  }

  const created = await runWebCommand(createSkillCommand, {
    name,
    description: text(form, "newSkillDescription") || `Skill of the agent ${text(form, "id")}.`,
    body: text(form, "newSkillContent"),
  });

  return created.ok ? { ok: true, message: created.value.name } : { ok: false, message: created.error };
}

export async function deleteAgentAction(id: string): Promise<ActionResult> {
  const deleted = await runWebCommand(deleteAgentCommand, { id });

  if (!deleted.ok) {
    return { ok: false, message: deleted.error };
  }

  revalidatePath("/agents");
  redirect("/agents");
}

export async function saveGlobalAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const saved = await runWebCommand(saveAgentsGlobalCommand, { dailyBudgetUsd: Number(text(form, "dailyBudgetUsd")) });

  if (!saved.ok) {
    return { ok: false, message: saved.error };
  }

  revalidatePath("/settings");

  return { ok: true, message: "Saved." };
}

// The whole form as agent.update takes it: every field is sent, so the command replaces them all.
function updateInputFromForm(form: FormData, current: AgentDefinition): UpdateAgentInput {
  const next = readAgentForm(form, current);

  return {
    id: current.id,
    enabled: next.enabled,
    schedule: next.schedule,
    model: next.model,
    limits: next.limits,
    budgets: next.budgets,
    webAccess: next.capabilities.webAccess,
    grants: grantsOf(next),
    skills: next.skills,
    prompt: next.prompt ?? "",
    options: numberOptions(next),
    canAssign: next.canAssign,
    handles: next.handles,
    waitFor: next.waitFor,
  };
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

// The integrations switched on, as the commands take them.
function grantsOf(agent: AgentDefinition): string[] {
  return Object.entries(agent.capabilities.integrations ?? {}).filter(([, on]) => on).map(([key]) => key);
}

function numberOptions(agent: AgentDefinition): Record<string, number> {
  return Object.fromEntries(Object.entries(agent.options).filter((entry): entry is [string, number] => typeof entry[1] === "number"));
}

// One field per declared option (`option:<key>`); AgentConfig checks the ranges.
function readOptions(form: FormData, current: AgentDefinition): Record<string, AgentOptionValue> {
  return Object.fromEntries(current.optionSpecs.map((spec) => [spec.key, Number(text(form, `option:${spec.key}`))]));
}

// One checkbox per integration the host declares (`integration:<key>`); undeclared keys never reach the definition.
function readIntegrations(form: FormData, current: AgentDefinition): Record<string, boolean> {
  return Object.fromEntries((current.integrationSpecs ?? []).map((spec) => [spec.key, form.get(`integration:${spec.key}`) === "on"]));
}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

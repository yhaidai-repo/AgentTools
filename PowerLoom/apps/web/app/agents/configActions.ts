"use server";

import type { AgentDefinition, AgentOptionValue } from "@agenttools/config";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAgentCommand, createSkillCommand, deleteAgentCommand, newAgentTemplate, prepareAgentCreation, prepareAgentUpdate, providerOfModel, saveAgentsGlobalCommand, saveFrameworkCommand, updateAgentCommand, type UpdateAgentInput } from "@powerloom/core";
import { getAgentConfig } from "@/lib/agentConfig";
import { runWebCommand } from "@/lib/commandContext";
import type { ActionResult } from "@/models/ActionResult";

// The Config page's save runs agent.update (the command a chat uses too): the whole form, prompt versioning and
// validation inside the command; the agent-runner is notified and reschedules by itself. A skill written under Skills is
// created first and added to the agent's skills.
export async function saveAgentAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const current = await getAgentConfig().get(text(form, "id"));

  if (!current) {
    return { ok: false, message: "Unknown agent." };
  }

  const input = updateInputFromForm(form, current);
  const skillName = text(form, "newSkillName");
  input.skills = [...new Set([...(input.skills ?? []), ...(skillName ? [skillName] : [])])];
  const checked = await runWebCommand({ ...updateAgentCommand, run: (context, parsed) => prepareAgentUpdate(context, parsed, skillName) }, input);
  if (!checked.ok) return { ok: false, message: checked.error };

  const skill = await createNewSkill(form);

  if (skill && !skill.ok) {
    return skill;
  }

  let saved;
  try { saved = await runWebCommand(updateAgentCommand, input); }
  catch (error) { return saveRefusal(error instanceof Error ? error.message : String(error), skill); }

  if (!saved.ok) {
    return saveRefusal(saved.error, skill);
  }

  revalidatePath("/agents");
  revalidatePath(`/agents/${saved.value.id}/config`);

  return { ok: true, message: `${current.label} saved. The agent-runner applies it right away.` };
}

// A new agent (user decision 2026-10-23; the Config form itself since 2026-10-24): the whole form on the template's
// defaults, a skill written with it, through agent.create. It runs on the generic executor.
export async function createAgentAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const template = await newAgentTemplate(getAgentConfig(), text(form, "id"));
  const agent = readAgentForm(form, template);
  const skillName = text(form, "newSkillName");
  const input = {
    id: text(form, "id"),
    label: agent.label,
    description: agent.description,
    prompt: agent.prompt ?? "",
    handles: agent.handles,
    skills: [...new Set([...agent.skills, ...(skillName ? [skillName] : [])])],
    canAssign: agent.canAssign,
    waitFor: agent.waitFor,
    grants: grantsOf(agent),
    webAccess: agent.capabilities.webAccess,
    model: agent.model,
    limits: agent.limits,
    budgets: agent.budgets,
    schedule: agent.schedule,
    enabled: agent.enabled,
    options: numberOptions(agent),
  };
  const checked = await runWebCommand({ ...createAgentCommand, run: (context, parsed) => prepareAgentCreation(context, parsed, skillName) }, input);
  if (!checked.ok) return { ok: false, message: checked.error };
  const skill = await createNewSkill(form);
  if (skill && !skill.ok) return skill;
  let created;
  try { created = await runWebCommand(createAgentCommand, input); }
  catch (error) { return saveRefusal(error instanceof Error ? error.message : String(error), skill); }

  if (!created.ok) {
    return saveRefusal(created.error, skill);
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
    reuseIfUnchanged: true,
  });

  return created.ok ? { ok: true, message: created.value.name } : { ok: false, message: created.error };
}

function saveRefusal(message: string, skill: ActionResult | null): ActionResult {
  return { ok: false, message: `${message}${skill?.ok ? ` Skill ${skill.message} is saved; retrying will reuse it if unchanged.` : ""}` };
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

// Settings → Agents: the shared framework; the code's text again puts the agents back on the file.
export async function saveFrameworkAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const saved = await runWebCommand(saveFrameworkCommand, { text: text(form, "prompt") });

  if (!saved.ok) {
    return { ok: false, message: saved.error };
  }

  revalidatePath("/settings");

  return { ok: true, message: saved.value.onFile ? "Saved: the agents use the code's framework." : `Saved as version ${saved.value.version}.` };
}

// The whole form as agent.update takes it: every field is sent, so the command replaces them all.
function updateInputFromForm(form: FormData, current: AgentDefinition): UpdateAgentInput {
  const next = readAgentForm(form, current);

  return {
    id: current.id,
    label: next.label,
    description: next.description,
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
  const model = text(form, "model");

  return {
    ...current,
    label: text(form, "label") || current.label,
    description: text(form, "description"),
    enabled: form.get("enabled") === "on",
    schedule: text(form, "schedule") || null,
    // The provider follows the chosen model (a Codex model runs on Codex), so the form has no provider field.
    model: { provider: providerOfModel(model, current.model.provider), model, ...(effort ? { effort: effort as AgentDefinition["model"]["effort"] } : {}) },
    limits: { maxTurns: Number(text(form, "maxTurns")), timeoutMinutes: Number(text(form, "timeoutMinutes")) },
    budgets: { perRunUsd: Number(text(form, "perRunUsd")), dailyUsd: Number(text(form, "dailyUsd")) },
    capabilities: { webAccess: form.get("webAccess") === "on", integrations: readIntegrations(form, current) },
    skills: form.getAll("skills").map(String),
    prompt: text(form, "prompt"),
    options: readOptions(form, current),
    canAssign: form.getAll("canAssign").map(String),
    handles: handlesOf(form),
    waitFor: form.getAll("waitFor").map(String),
  };
}

// The chosen task types plus a new one typed for the agent (user decision 2026-10-24); the commands check its form.
function handlesOf(form: FormData): string[] {
  const typed = text(form, "newTaskType");
  const chosen = form.getAll("handles").map(String);

  return typed && !chosen.includes(typed) ? [...chosen, typed] : chosen;
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

// One checkbox per integration the host declares (`integration:<key>`); undeclared keys never reach the definition. The
// agent's owned ones are always on and not on the form.
function readIntegrations(form: FormData, current: AgentDefinition): Record<string, boolean> {
  return Object.fromEntries((current.integrationSpecs ?? []).map((spec) => [spec.key, spec.owner !== undefined || form.get(`integration:${spec.key}`) === "on"]));
}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

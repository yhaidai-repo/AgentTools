"use server";

import { isRemovable, validateAgent, validateGlobal, type AgentDefinition, type AgentOptionValue } from "@agenttools/config";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAgentCommand, createSkillCommand, newAgentTemplate } from "@powerloom/core";
import { getAgentConfig } from "@/lib/agentConfig";
import { runWebCommand } from "@/lib/commandContext";
import { readPromptFile } from "@/lib/promptFiles";
import { deletePromptVersions, insertPromptVersion } from "@/lib/promptVersions";
import type { ActionResult } from "@/models/ActionResult";

// Saves through AgentConfig only; the agent-runner is notified and reschedules by itself.
export async function saveAgentAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const store = getAgentConfig();
  const current = await store.get(text(form, "id"));

  if (!current) {
    return { ok: false, message: "Unknown agent." };
  }

  const checked = validateAgent(await withPromptVersion(readAgentForm(form, current), current));

  if (!checked.ok) {
    return { ok: false, message: checked.errors.join("; ") };
  }

  if (checked.value.promptVersion !== (current.promptVersion ?? 0)) {
    await insertPromptVersion(checked.value.id, checked.value.promptVersion ?? 0, checked.value.prompt ?? "");
  }

  await store.save(checked.value);
  revalidatePath("/agents");
  revalidatePath(`/agents/${checked.value.id}/config`);

  return { ok: true, message: `${checked.value.label} saved. The agent-runner applies it right away.` };
}

// The prompt as typed: the file's own text = back on the file (nothing stored, also when a stored copy equals it);
// unchanged = the version stays; any other text = the next version (user decision 2026-10-23: every edit is a new version).
async function withPromptVersion(next: AgentDefinition, current: AgentDefinition): Promise<AgentDefinition> {
  const file = await readPromptFile(current.id);
  const typed = (next.prompt ?? "").replace(/\r\n/g, "\n").trim();
  const stored = (current.prompt ?? "").trim();
  const version = current.promptVersion ?? 0;

  if (file && typed === file.text.trim()) {
    return { ...next, prompt: "", promptVersion: version };
  }

  if (typed === stored) {
    return { ...next, prompt: current.prompt ?? "", promptVersion: version };
  }

  return { ...next, prompt: typed, promptVersion: version + 1 };
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
    grants: Object.entries(advanced.capabilities.integrations ?? {}).filter(([, on]) => on).map(([key]) => key),
    webAccess: advanced.capabilities.webAccess,
    model: advanced.model,
    limits: advanced.limits,
    budgets: advanced.budgets,
    schedule: null,
    enabled: false,
    options: Object.fromEntries(Object.entries(advanced.options).filter((entry): entry is [string, number] => typeof entry[1] === "number")),
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
  const store = getAgentConfig();
  const agent = await store.get(id);

  if (!agent) {
    return { ok: false, message: "Unknown agent." };
  }

  if (!isRemovable(agent)) {
    return { ok: false, message: "This agent is shipped with the code and can't be deleted." };
  }

  await store.remove(id);
  await deletePromptVersions(id);
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

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

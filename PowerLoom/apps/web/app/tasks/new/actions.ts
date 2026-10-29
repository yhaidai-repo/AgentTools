"use server";

import { guideRequestBlock, guideRequestSchema, readGuideRequest } from "@powerloom/core";
import { createTaskCommand, saveScheduleCommand } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { runWebCommand } from "@/lib/commandContext";
import { requireVault } from "@/lib/currentVault";
import { formText } from "@/lib/formFields";
import { itemPath } from "@/lib/items";
import type { ActionResult } from "@/models/ActionResult";
import type { TaskActionResult } from "@/models/TaskActionResult";
import type { TaskFormValues } from "@/models/TaskFormValues";

// One task now, or with a cron a schedule by task type (user decision 2026-10-14). PowerLoom checks the task against its
// type (PBI, repos) either way; a refusal returns what was typed, so the form keeps it.
export async function saveTaskAction(_previous: TaskActionResult | null, form: FormData): Promise<TaskActionResult> {
  const scheduled = formText(form, "scheduleId") !== null || formText(form, "cron") !== null;
  let saved: ActionResult;
  try { saved = scheduled ? await saveSchedule(form) : await createTask(form); }
  catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: errorText(error), values: submittedValues(form) };
  }
  return { ...saved, values: submittedValues(form) };
}

// zod is not a dependency of the web app, so its error is recognised by shape: issues as "path: message".
function errorText(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Invalid guide inputs.";
  }

  const issues = (error as { issues?: { path?: PropertyKey[]; message: string }[] }).issues;

  if (error.name !== "ZodError" || !Array.isArray(issues)) {
    return error.message;
  }

  return issues.map(issue => (issue.path?.length ? issue.path.map(String).join(".") + ": " : "") + issue.message).join("; ");
}

// The new task's page opens.
async function createTask(form: FormData): Promise<ActionResult> {
  const created = await runWebCommand(createTaskCommand, { ...readTask(form), vault: await requireVault(), cron: null });

  if (!created.ok || created.value.taskId === null) {
    return { ok: false, message: created.ok ? created.value.message : created.error };
  }

  revalidatePath("/tasks");
  redirect(itemPath({ id: created.value.taskId, pbiId: created.value.pbiId }));
}

// A schedule keeps its vault; a new one belongs to the vault selected in the top bar.
async function saveSchedule(form: FormData): Promise<ActionResult> {
  const id = formText(form, "scheduleId") === null ? null : Number(formText(form, "scheduleId"));
  const task = readTask(form);
  const saved = await runWebCommand(saveScheduleCommand, { id, vault: await requireVault(), name: task.title, cron: formText(form, "cron") ?? "", enabled: form.get("enabled") === "on", type: task.type, description: task.description, acceptanceCriteria: task.acceptanceCriteria, pbi: task.pbi, repos: task.repos });

  if (!saved.ok) {
    return { ok: false, message: saved.error };
  }

  revalidatePath("/tasks");
  redirect("/tasks");
}

function readTask(form: FormData) {
  return {
    type: formText(form, "type") ?? "",
    title: formText(form, "title") ?? "",
    description: guideDescription(form),
    acceptanceCriteria: formText(form, "acceptanceCriteria") ?? "",
    pbi: formText(form, "pbi"),
    repos: form.getAll("repos").map(String).filter(Boolean),
  };
}

// The form as it was sent, untrimmed: what the user sees again after a refusal.
function submittedValues(form: FormData): TaskFormValues {
  const text = (name: string) => String(form.get(name) ?? "");
  const scheduleId = formText(form, "scheduleId");

  return {
    guideInputs: Object.fromEntries([...form.entries()].filter(([key]) => key.startsWith("guide")).map(([key, value]) => [key, String(value)])),
    type: text("type"),
    title: text("title"),
    description: text("description"),
    acceptanceCriteria: text("acceptanceCriteria"),
    pbi: text("pbi"),
    repos: form.getAll("repos").map(String).filter(Boolean),
    scheduleId: scheduleId === null ? null : Number(scheduleId),
    cron: text("cron"),
    enabled: form.get("enabled") === "on",
  };
}

function guideDescription(form: FormData): string {
  const description = formText(form, "description") ?? "";
  if (formText(form, "type") !== "demonstration") return description;
  if (!form.has("guideMode")) { readGuideRequest(description); return description; }
  const value = (key: string) => String(form.get(key) ?? "").trim();
  const list = (key: string) => value(key).split(",").map(v => v.trim()).filter(Boolean);
  const action = value("guidePublishAction");
  const destination = action === "create"
    ? { action, site: value("guideSite"), space: value("guideSpace"), title: value("guidePageTitle"), parentId: value("guidePageId") }
    : action === "update"
      ? { action, site: value("guideSite"), space: value("guideSpace"), title: value("guidePageTitle"), pageId: value("guidePageId"), version: Number(value("guidePageVersion")), sections: value("guideSections") }
      : { action: "unspecified" };
  const request = guideRequestSchema.parse({
    mode: value("guideMode"), url: value("guideUrl"),
    allowedOrigins: list("guideOrigins").length ? list("guideOrigins") : [new URL(value("guideUrl")).origin],
    branch: value("guideBranch"), services: list("guideServices"),
    audience: value("guideAudience"), environment: value("guideEnvironment"), permittedActions: value("guideActions"),
    data: value("guideData"), owner: value("guideOwner"), release: value("guideRelease"), maskSelectors: list("guideMasks"), destination,
  });
  return description.replace(/\x60{3}demonstration\s*\n[\s\S]*?\n\x60{3}/g, "").trim() + guideRequestBlock(request);
}

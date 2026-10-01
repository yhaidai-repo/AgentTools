"use server";

import { applyRefinementSchedule, readAgentSettings, saveAgentSettings, type AgentSettings, type StageSettings } from "@adoa/core";
import { revalidatePath } from "next/cache";
import { getBoss } from "@/lib/boss";
import { getDb } from "@/lib/db";
import type { ActionResult } from "@/models/ActionResult";

export async function saveAgentSettingsAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const current = await readAgentSettings(getDb());
  const refinement = readStageForm(form);
  const invalid = findInvalid(refinement, Number(form.get("dailyBudgetUsd")));

  if (invalid) {
    return { ok: false, message: invalid };
  }

  try {
    await applyRefinementSchedule(await getBoss(), refinement.cron, refinement.enabled);
  } catch (error) {
    return { ok: false, message: `Schedule not saved: ${error instanceof Error ? error.message : String(error)}` };
  }

  const settings: AgentSettings = { ...current, dailyBudgetUsd: Number(form.get("dailyBudgetUsd")), refinement };

  await saveAgentSettings(getDb(), settings);
  revalidatePath("/settings");
  revalidatePath("/agents");

  return { ok: true, message: "Agent settings saved. The next run uses them." };
}

function readStageForm(form: FormData): StageSettings {
  const text = (name: string) => String(form.get(name) ?? "").trim();

  return {
    enabled: form.get("enabled") === "on",
    cron: text("cron"),
    batchSize: Number(text("batchSize")),
    provider: text("provider"),
    model: text("model"),
    maxTurns: Number(text("maxTurns")),
    timeoutMinutes: Number(text("timeoutMinutes")),
    perRunBudgetUsd: Number(text("perRunBudgetUsd")),
    dailyBudgetUsd: Number(text("stageDailyBudgetUsd")),
    skills: text("skills").split(",").map((skill) => skill.trim()).filter(Boolean),
    maxFailures: Number(text("maxFailures")),
  };
}

function findInvalid(stage: StageSettings, dailyBudgetUsd: number): string | null {
  const wholeNumbers = [stage.batchSize, stage.maxTurns, stage.timeoutMinutes, stage.maxFailures];
  const amounts = [stage.perRunBudgetUsd, stage.dailyBudgetUsd, dailyBudgetUsd];

  if (!wholeNumbers.every((value) => Number.isInteger(value) && value > 0)) {
    return "Batch, turns, timeout and failures must be whole numbers above 0.";
  }

  return amounts.every((value) => Number.isFinite(value) && value >= 0) ? null : "Budgets must be 0 or more.";
}

"use server";

import { checkConnection } from "@adoa/ado";
import { applySyncSchedule, saveAdoSettings, saveSyncSettings, type AdoSettings, type SyncSettings } from "@adoa/core";
import { revalidatePath } from "next/cache";
import { getBoss } from "@/lib/boss";
import { getDb } from "@/lib/db";
import type { ActionResult } from "@/models/ActionResult";

export async function saveSettings(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const ado = readAdoForm(form);
  const sync = readSyncForm(form);

  if (!Number.isInteger(sync.maxItemsPerRun) || sync.maxItemsPerRun < 1) {
    return { ok: false, message: "Max PBIs per sync must be a whole number above 0." };
  }

  try {
    await applySyncSchedule(await getBoss(), sync.cron);
  } catch (error) {
    return { ok: false, message: `Schedule not saved: ${errorMessage(error)}` };
  }

  await saveAdoSettings(getDb(), ado);
  await saveSyncSettings(getDb(), sync);
  revalidatePath("/settings");

  return { ok: true, message: "Saved. The next sync uses these settings." };
}

export async function testConnection(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const pat = process.env.ADO_PAT;

  if (!pat) {
    return { ok: false, message: "ADO_PAT is missing in .env." };
  }

  const ado = readAdoForm(form);

  return checkConnection({ orgUrl: ado.orgUrl, project: ado.project, team: ado.team, pat });
}

function readAdoForm(form: FormData): AdoSettings {
  return {
    orgUrl: field(form, "orgUrl"),
    project: field(form, "project"),
    team: field(form, "team"),
    user: field(form, "user"),
  };
}

function readSyncForm(form: FormData): SyncSettings {
  return {
    cron: field(form, "cron"),
    maxItemsPerRun: Number(field(form, "maxItemsPerRun")),
    sprint: field(form, "sprint") || "current",
    states: field(form, "states").split(",").map((state) => state.trim()).filter(Boolean),
  };
}

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

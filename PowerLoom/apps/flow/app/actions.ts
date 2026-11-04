"use server";

import type { Outcome } from "@powerloom/core";
import { cancelFlowExecutionCommand } from "@powerloom/core/src/commands/cancelFlowExecutionCommand";
import { deleteFlowCommand } from "@powerloom/core/src/commands/deleteFlowCommand";
import { runFlowCommand as runFlow } from "@powerloom/core/src/commands/runFlowCommand";
import { saveFlowCommand } from "@powerloom/core/src/commands/saveFlowCommand";
import type { FlowTarget } from "@powerloom/core/src/models/FlowTarget";
import { revalidatePath } from "next/cache";
import { runFlowCommand } from "@/lib/commandContext";
import { requireVault } from "@/lib/currentVault";
import type { SavedDefinition } from "@/models/FlowDefinition";

// The Flow app's changes, each one a command through PowerLoom's API (lib/commandContext.ts); the pages re-read the
// database afterwards. Expected failures (a definition PowerLoom refuses, a flow that still runs) come back as messages.

export interface SavedFlowResult {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
}

export async function saveFlowAction(input: { id: string | null; name: string; definition: SavedDefinition }): Promise<Outcome<SavedFlowResult>> {
  const vault = await requireVault();
  const outcome = await runFlowCommand(saveFlowCommand, { id: input.id, vault, name: input.name, definition: input.definition });

  if (!outcome.ok) return outcome;

  revalidatePath("/", "layout");

  return { ok: true, value: { id: outcome.value.id, name: outcome.value.name, version: outcome.value.version, updatedAt: outcome.value.updatedAt.toISOString() } };
}

export async function deleteFlowAction(id: string): Promise<Outcome<{ name: string }>> {
  const outcome = await runFlowCommand(deleteFlowCommand, { id });

  if (!outcome.ok) return outcome;

  revalidatePath("/", "layout");

  return { ok: true, value: { name: outcome.value.name } };
}

export async function runFlowAction(id: string, target: FlowTarget): Promise<Outcome<{ executionId: string }>> {
  const vault = await requireVault();
  const outcome = await runFlowCommand(runFlow, { id, vault, target });

  if (!outcome.ok) return outcome;

  revalidatePath("/", "layout");

  return { ok: true, value: { executionId: outcome.value.id } };
}

export async function cancelExecutionAction(id: string): Promise<Outcome<{ status: string }>> {
  const outcome = await runFlowCommand(cancelFlowExecutionCommand, { id });

  if (!outcome.ok) return outcome;

  revalidatePath("/", "layout");

  return { ok: true, value: { status: outcome.value.status } };
}

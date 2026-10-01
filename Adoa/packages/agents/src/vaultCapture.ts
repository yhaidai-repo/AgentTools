import { vaultCapture, type AdoaDb } from "@adoa/db";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { CaptureDraft } from "./models/CaptureDraft";

// VaultCapture: an agent records unverified findings for the docs vault. Per the vault's rules they become
// draft/ notes (never edits to verified notes); captures are kept only if the run succeeds.
export function createVaultCaptureTool(captures: CaptureDraft[]): ToolDefinition<any> {
  return defineTool({
    name: "vault_capture",
    description:
      "Capture findings worth keeping in the docs vault (facts about the system, not about this PBI's plan). " +
      "They become an unverified draft note for a person to verify and merge. One call per topic; check the docs first so you don't capture what is already documented.",
    input: {
      title: z.string().min(1).describe("Topic, e.g. 'MedicaidRecipientFacilityChanged delta: states and payload'"),
      project: z.string().min(1).describe("Docs vault project key (top-level folder), e.g. pvs or pvsi"),
      target: z.string().min(1).describe("Where it belongs once verified: '[[note-name]]' or a folder like 'pvsi/signals'"),
      captured: z.array(z.object({ fact: z.string(), evidence: z.string() })).min(1).describe("Facts, each with evidence ('<repo>/<path>:<line>' or doc path)"),
      to_fill: z.array(z.string()).describe("What is still unknown or needs checking"),
    },
    handler: async (input) => {
      captures.push({ title: input.title, project: input.project, target: input.target, captured: input.captured, toFill: input.to_fill });

      return { text: `Capture ${captures.length} noted; it becomes a draft note if the run succeeds.` };
    },
  });
}

export async function commitCaptures(db: AdoaDb, runId: number, pbiId: number, itemId: string | null, captures: CaptureDraft[]): Promise<string[]> {
  if (captures.length === 0) {
    return [];
  }

  const rows = await db
    .insert(vaultCapture)
    .values(captures.map((capture) => ({ runId, pbiId, itemId, ...capture })))
    .returning({ id: vaultCapture.id });

  return rows.map((row) => `CAP-${row.id}`);
}

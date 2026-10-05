import { pbiFeedback, workItem } from "@adoa/db";
import { eq } from "drizzle-orm";
import type { CommandContext } from "../models/CommandContext";
import type { NewWwwRecord } from "../models/NewWwwRecord";
import type { PbiFeedback } from "../models/PbiFeedback";
import { createWwwRecord } from "../www/createWwwRecord";
import { pbiDocsProject } from "./pbiDocsProject";

const TITLE_MAX = 80;

// Checked before the PBI is finished, so a finish never leaves its feedback behind.
export function feedbackProblem(context: CommandContext, feedback: PbiFeedback): string | null {
  return feedback.whatWentWrong && !context.docsVaultName ? "Set DOCS_VAULT_NAME: the WWW record goes to the docs vault's www-log.md." : null;
}

// The rating and effort row; when the user said what went wrong, a WWW record in the docs vault's log, linked to the row
// (user decision 2026-10-05: the text becomes Happened, the rest stays open for later analysis).
export async function recordPbiFeedback(context: CommandContext, feedback: PbiFeedback): Promise<number | null> {
  const wwwRecordId = feedback.whatWentWrong ? await logWhatWentWrong(context, feedback, feedback.whatWentWrong) : null;

  await context.db.insert(pbiFeedback).values({ pbiId: feedback.adoId, rating: feedback.rating, effortHours: String(feedback.effortHours), wwwRecordId });

  return wwwRecordId;
}

async function logWhatWentWrong(context: CommandContext, feedback: PbiFeedback, text: string): Promise<number> {
  const [pbi] = await context.db.select({ title: workItem.title }).from(workItem).where(eq(workItem.adoId, feedback.adoId));
  const record: NewWwwRecord = {
    vault: context.docsVaultName ?? "",
    source: `PBI-${feedback.adoId} finish`,
    title: `PBI-${feedback.adoId}: ${text.split(/\r?\n/)[0].slice(0, TITLE_MAX)}`,
    kind: "complaint",
    project: await pbiDocsProject(context.db, feedback.adoId),
    planned: `The agents (refinement, research, design) prepare PBI-${feedback.adoId} "${pbi?.title ?? ""}" so it can be implemented`,
    happened: `${text} (agent rating ${feedback.rating}/10, user effort ${feedback.effortHours} h)`,
    fault: feedback.fault,
    rootCause: null,
    resolution: null,
    preventiveAction: null,
    assumptions: "Logged from adoa's Finish dialog; root cause and prevention not analysed yet",
  };

  return createWwwRecord(context, record);
}

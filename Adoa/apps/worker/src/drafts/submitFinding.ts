import { setItemStatus, type RegisterJob } from "@adoa/core";
import { localItem, type AdoaDb } from "@adoa/db";
import { VaultCaptureCli } from "@adoa/notes";
import { eq } from "drizzle-orm";

const ACTOR = "human";

// The user's "Submit to vault" (their yes, as the vault rules require): the record goes into the project's register
// through VaultCapture, and the finding closes with its id. A rejected record leaves the finding open with the reason.
export async function submitFinding(db: AdoaDb, job: RegisterJob): Promise<string> {
  const [finding] = await db.select().from(localItem).where(eq(localItem.id, job.findingId));

  if (finding?.status !== "in-progress") {
    return `${job.findingId}: not waiting for a submit (${finding?.status ?? "gone"})`;
  }

  const cli = await VaultCaptureCli.fromEnv(`${job.findingId} goes into the ${job.project} register`);
  const added = await cli.addRegisterRecord({ project: job.project, kind: job.kind, title: job.title, text: job.text, default: job.default, options: job.options });
  const register = job.kind === "questions" ? "open-questions" : "known-issues";
  const resolution = added.ok ? `Recorded as ${added.value} in ${job.project}-${register}.` : `Not recorded: ${added.error}`;

  await db.update(localItem).set({ resolution }).where(eq(localItem.id, finding.id));
  await setItemStatus(db, finding.id, "in-progress", added.ok ? "done" : "open", ACTOR);

  return `${finding.id}: ${resolution}`;
}

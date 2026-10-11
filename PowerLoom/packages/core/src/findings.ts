import { localItem, type PowerLoomDb } from "@powerloom/db";
import { and, eq } from "drizzle-orm";
import type { Outcome } from "./models/Outcome";
import type { RegisterJob } from "./models/RegisterJob";
import type { SubmitFindingRequest } from "./models/SubmitFindingRequest";
import { itemOfPbi, pbiLabel } from "./itemScope";
import { setItemStatus } from "./pbiStatus";

const REGISTER_KINDS: Record<SubmitFindingRequest["type"], RegisterJob["kind"]> = { question: "questions", issue: "issues" };

// Saves the user's version of the finding and marks it in-progress; the worker's register job writes the record
// (the vault rules' "ask the user first" is this submit) and closes the finding.
export async function startFindingSubmit(db: PowerLoomDb, request: SubmitFindingRequest): Promise<Outcome<RegisterJob>> {
  const problem = submitProblem(request);

  if (problem) {
    return { ok: false, error: problem };
  }

  const [finding] = await db.select().from(localItem).where(and(eq(localItem.id, request.itemId), eq(localItem.kind, "finding"), itemOfPbi(request.adoId)));

  if (finding?.status !== "open") {
    return { ok: false, error: finding ? `${finding.id} is already ${finding.status}.` : `${request.itemId} is not a finding of ${pbiLabel(request.adoId)}.` };
  }

  const job = registerJobOf(request);

  await db.update(localItem).set({
    title: job.title.slice(0, 120),
    body: job.text,
    data: { type: request.type, project: job.project, default: job.default, options: job.options },
  }).where(eq(localItem.id, finding.id));
  await setItemStatus(db, finding.id, "open", "in-progress", "human");

  return { ok: true, value: job };
}

function submitProblem(request: SubmitFindingRequest): string | null {
  if (!REGISTER_KINDS[request.type]) {
    return "Choose open question or known issue.";
  }

  if (!/^[a-z0-9-]+$/.test(request.project)) {
    return "The project is the vault folder name, e.g. PowerLoom.";
  }

  return request.title && request.text ? null : "A title and the text are required.";
}

function registerJobOf(request: SubmitFindingRequest): RegisterJob {
  return {
    findingId: request.itemId,
    project: request.project,
    kind: REGISTER_KINDS[request.type],
    title: request.title ?? "",
    text: request.text ?? "",
    default: request.default,
    options: request.options,
  };
}

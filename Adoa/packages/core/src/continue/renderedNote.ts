import type { CommandContext } from "../models/CommandContext";

// The chat reads its note right after it opens, so opening waits for the worker's job (seconds). Waiting for the job, not
// the file: a note from an earlier chat exists already, and an unchanged note isn't rewritten.
const NOTE_WAIT_MS = 15_000;

// Has the worker render a note, then checks it is in the vault; returns why not, or null.
export async function renderedNoteProblem(context: CommandContext, queue: string, job: object, backlogRelativePath: string): Promise<string | null> {
  const completed = await context.jobs.sendAndWait(queue, job, NOTE_WAIT_MS);

  return completed && (await context.notes.exists(backlogRelativePath)) ? null : "The note isn't in the vault yet (is the worker running?). Try again.";
}

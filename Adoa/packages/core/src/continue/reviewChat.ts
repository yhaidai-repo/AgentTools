import { codeReview, pullRequest } from "@adoa/db";
import { reviewNotePath } from "@adoa/vault";
import { eq } from "drizzle-orm";
import type { ChatPlan } from "../models/ChatPlan";
import type { CommandContext } from "../models/CommandContext";
import type { ContinueEnv } from "../models/ContinueEnv";
import type { Outcome } from "../models/Outcome";
import type { ReviewNoteJob } from "../models/ReviewNoteJob";
import { REVIEW_NOTE_QUEUE } from "../queues";
import { backlogHostFolder, backlogHostPath, chatHostFolder, repoHostPaths } from "./hostPaths";
import { renderedNoteProblem } from "./renderedNote";

// A review's chat (user decision 2026-10-05): review only, no fixes. It adds the PR's repo, then follows the review note's
// Start section: a briefing, and answers to the comments after the user's yes. The worker renders the note first.
export async function reviewChatPlan(env: ContinueEnv, context: CommandContext, prId: number): Promise<Outcome<ChatPlan>> {
  const [row] = await context.db.select({ pr: pullRequest, review: codeReview }).from(codeReview).innerJoin(pullRequest, eq(pullRequest.id, codeReview.prId)).where(eq(codeReview.prId, prId));

  if (!row || row.review.status === "closed") {
    return { ok: false, error: row ? "The review is closed." : `No review for PR ${prId}.` };
  }

  const notePath = reviewNotePath(prId);
  const job: ReviewNoteJob = { prId };
  const request = {
    title: `Review PR ${prId}: ${row.pr.title}`,
    intro: [],
    folder: chatHostFolder(env, row.pr.vault),
    extraFolders: [backlogHostFolder(env, row.pr.vault), ...repoHostPaths(env, [row.pr.repoName])],
    steps: [`Read ${backlogHostPath(env, row.pr.vault, notePath)} and follow its Start section: brief me first, and ask before you write anything. Review only: change no file.`],
  };

  return { ok: true, value: { request, prepare: (preparing) => renderedNoteProblem(preparing, REVIEW_NOTE_QUEUE, job, row.pr.vault, notePath) } };
}

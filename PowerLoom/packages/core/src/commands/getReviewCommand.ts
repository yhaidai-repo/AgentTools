import { z } from "zod";
import type { Command } from "../models/Command";
import type { ReviewRead } from "../models/ReviewRead";
import { toReviewRead } from "../reviews/reviewReads";
import { loadReviewDetail } from "../reviews/reviews";
import { vaultInput } from "./inputs";

const input = z.object({
  prId: z.number().int().positive().describe("The pull request's id, as review_list gives it"),
  vault: vaultInput,
});

export const getReviewCommand: Command<{ prId: number; vault: string }, ReviewRead> = {
  name: "review.get",
  effect: "read",
  description: "Read one code review: the pull request, the agents' summary, every comment with its answer, the review tasks and their runs with cost. Pass a review run's id as `review` kind to result_get for that run's own summary.",
  input,
  async run(context, input) {
    if (!context.usage) {
      return { ok: false, error: "review.get needs the runs' usage records, which this caller doesn't have." };
    }

    const detail = await loadReviewDetail(context.db, context.usage, input.prId, input.vault);

    if (!detail) {
      return { ok: false, error: `Pull request ${input.prId} has no review in vault ${input.vault}.` };
    }

    return { ok: true, value: toReviewRead(detail) };
  },
};

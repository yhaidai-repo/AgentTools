import { z } from "zod";
import type { Command } from "../models/Command";
import { mapOutcome } from "./mapOutcome";

// Local only: ADO isn't told (user decision 2026-10-02). review.queue reopens it.
export const closeReviewCommand: Command<{ prId: number; reason: string | null }, { message: string }> = {
  name: "review.close",
  effect: "destructive",
  description: "Close a review in PowerLoom only (Azure DevOps isn't told); review_queue starts it again. Confirm with the user first, naming the pull request, and ask whether they want to give a reason.",
  input: z.object({
    prId: z.number().int().describe("The review's PR id (review_list)"),
    reason: z.string().trim().min(1).nullable().default(null).describe("Why, shown on the review"),
  }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.closeReview(input.prId, input.reason), (title) => ({ message: `Review closed: ${title}.` }));
  },
};

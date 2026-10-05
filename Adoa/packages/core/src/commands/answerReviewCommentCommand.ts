import { z } from "zod";
import type { Command } from "../models/Command";
import { answerReviewComment } from "../reviewComments";

export const answerReviewCommentCommand: Command<{ commentId: string; answer: string | null }, { prId: number; answered: boolean }> = {
  name: "review.answerComment",
  description: "Answer a code-review comment (the agent's next run on the PR reads it); an empty answer takes it back.",
  input: z.object({ commentId: z.string().min(1), answer: z.string().trim().transform((text) => text || null).nullable().default(null) }),
  async run(context, input) {
    const answered = await answerReviewComment(context.db, input.commentId, input.answer);

    return answered.ok ? { ok: true, value: { prId: answered.value.prId, answered: input.answer !== null } } : answered;
  },
};

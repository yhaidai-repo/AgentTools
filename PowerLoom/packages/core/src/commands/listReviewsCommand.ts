import { z } from "zod";
import type { Command } from "../models/Command";
import { REVIEW_LIST_STATUSES, type ReviewListStatus } from "../models/ReviewListStatus";
import type { ReviewSummary } from "../models/ReviewSummary";
import { matchesReviewStatus } from "../reviews/reviewLooks";
import { toReviewSummary } from "../reviews/reviewReads";
import { loadReviewRows } from "../reviews/reviews";
import { limitInput, vaultInput } from "./inputs";

const MAX_ROWS = 200;
const DEFAULT_ROWS = 50;

const input = z.object({
  vault: vaultInput,
  status: z.enum(REVIEW_LIST_STATUSES).default("all").describe("Which reviews: active, closed or all"),
  limit: limitInput(MAX_ROWS, DEFAULT_ROWS),
});

export const listReviewsCommand: Command<{ vault: string; status: ReviewListStatus; limit: number }, ReviewSummary[]> = {
  name: "review.list",
  effect: "read",
  description: "List the vault's code reviews, newest pull requests first: the PR, its branches, where the review stands, its comment counts, pushes since the reviewed commit and whether it needs the user. Pass a prId to review.get.",
  input,
  async run(context, input) {
    const rows = await loadReviewRows(context.db, input.vault);
    const matching = rows.filter((row) => matchesReviewStatus(row, input.status)).slice(0, input.limit);

    return { ok: true, value: matching.map(toReviewSummary) };
  },
};

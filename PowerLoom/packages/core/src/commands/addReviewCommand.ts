import { z } from "zod";
import type { AddedReview } from "../models/AddedReview";
import type { Command } from "../models/Command";
import { vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

// Reviews → Add review (user decision 2026-10-21): a branch of an Azure DevOps repo.
export const addReviewCommand: Command<{ vault: string; repo: string; branch: string; targetBranch: string | null; pbi: string | null }, AddedReview> = {
  name: "review.add",
  description: "Add a review of a branch: PowerLoom adds the branch's active pull request, or else a branch review compared with the target branch (default: the repo's default branch); a branch only on this PC becomes a branch review that turns into an Azure DevOps one once pushed. The review waits until review_queue starts it. Ask the user for the repo (offer the vault's enabled Azure DevOps repos, settings_get) and the branch; the target and the PBI only if they want them.",
  input: z.object({
    vault: vaultInput,
    repo: z.string().trim().min(1).describe("An enabled Azure DevOps repo of the vault"),
    branch: z.string().trim().min(1).describe("The branch, e.g. feature/30474-new-report"),
    targetBranch: z.string().trim().min(1).nullable().default(null).describe("What a branch review is compared with; null: the repo's default. A PR keeps its own target"),
    pbi: z.string().trim().min(1).nullable().default(null).describe("A branch review's PBI; null: the number in the branch name"),
  }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.addReview(input), (added) => added);
  },
};

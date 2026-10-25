import { z } from "zod";
import type { AddedLocalReview } from "../models/AddedLocalReview";
import type { Command } from "../models/Command";
import type { NewLocalReview } from "../models/NewLocalReview";
import { vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

// Reviews → Add local review (user decision 2026-10-25): a branch of a local repo against a base, without Azure DevOps.
export const addLocalReviewCommand: Command<NewLocalReview, AddedLocalReview> = {
  name: "review.addLocal",
  description: "Add a review of a branch of a local repo (a folder of the repos root, added in Settings → Repositories; no Azure DevOps needed): the branch is compared with the base branch, like a pull request. Each review run reviews the branch's head at its start, so a rerun picks up new commits. The review waits until review_queue starts it. Ask the user for the repo (offer the vault's enabled local repos, settings_get) and the branch; the base and the PBI only if they want them.",
  input: z.object({
    vault: vaultInput,
    repo: z.string().trim().min(1).describe("An enabled local repo of the vault: its folder name"),
    branch: z.string().trim().min(1).describe("The branch, e.g. feature/30474-other-payer"),
    baseBranch: z.string().trim().min(1).nullable().default(null).describe("What the branch is compared with; null: the repo's default branch"),
    pbi: z.string().trim().min(1).nullable().default(null).describe("The review's PBI; null: the number in the branch name"),
  }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.addLocalReview(input), (added) => added);
  },
};

import { z } from "zod";
import type { Command } from "../models/Command";
import type { RepoSummary } from "../models/RepoSummary";
import { vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

// Settings → Repositories → Add local repo: a git checkout under the repos folder on this PC.
export const addLocalRepoCommand: Command<{ vault: string; name: string }, RepoSummary> = {
  name: "repo.addLocal",
  description: "Add a local repository to the vault: a git checkout's folder name under the repos folder on this PC (PowerLoom checks the folder). Ask the user for the folder name; never guess it.",
  input: z.object({ vault: vaultInput, name: z.string().trim().min(1).describe("The checkout's folder name under the repos folder") }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.addLocalRepo(input.vault, input.name), (repo) => repo);
  },
};

import { z } from "zod";
import type { Command } from "../models/Command";
import type { RepoBuildCommands } from "../models/RepoBuildCommands";
import { repoCommandInput, saveRepoCommands } from "../repoCommands";
import { catalogRepoNamed } from "../repos";
import { vaultInput } from "./inputs";

// Settings → Repositories: what the implementation agent's GSD builds and tests with (workflow.build_command and
// test_command), run in the run's sandbox when the worktree's shell is given one of them.
export const saveRepoCommandsCommand: Command<{ vault: string; repo: string; build: string; test: string }, RepoBuildCommands> = {
  name: "repo.saveCommands",
  description: "Set a repo's build and test commands for the vault's coding runs (Settings → Repositories): the implementation agent builds and tests with them, in the run's sandbox. Each is one command or `cd <folder> && <command>`; an empty one clears it. Ask the user for the repo and for each command they didn't give (settings_get lists the catalogue with the current commands); show both commands and save after their yes.",
  input: z.object({
    vault: vaultInput,
    repo: z.string().trim().min(1).describe("The repo's name, as settings_get lists it (any case)"),
    build: repoCommandInput.describe("The build command; empty clears it"),
    test: repoCommandInput.describe("The test command; empty clears it"),
  }),
  async run(context, input) {
    const repo = await catalogRepoNamed(context.db, input.vault, input.repo);

    if (!repo) {
      return { ok: false, error: `No repo ${input.repo} in the catalogue of ${input.vault} (settings_get lists it).` };
    }

    const commands = { build: input.build || null, test: input.test || null };

    await saveRepoCommands(context.db, input.vault, repo.name, commands);

    return { ok: true, value: { repo: repo.name, ...commands } };
  },
};

import { z } from "zod";
import type { Command } from "../models/Command";
import type { CommandContext } from "../models/CommandContext";
import type { Outcome } from "../models/Outcome";
import { adoIntegrationProblem, isGitHubActive, readGitHubSettings } from "../settings";
import { vaultInput } from "./inputs";

const NO_SOURCE = "Neither Azure DevOps nor GitHub is set up for this vault: switch one on in Settings to list pull requests.";

// The Reviews page's "Check now": PowerLoom checks the vault's pull requests in Azure DevOps and on GitHub (user decision
// 2026-10-25), whichever the vault has; one vault's checks run one after the other.
export const syncPullRequestsCommand: Command<{ vault: string }, { message: string }> = {
  name: "pullRequests.sync",
  description: "Check the vault's pull requests now, in Azure DevOps and on GitHub, whichever the vault has (new ones become reviews waiting to be queued). Confirm with the user first, naming the vault.",
  input: z.object({ vault: vaultInput }),
  async run(context, input) {
    const sources = await sourcesOf(context, input.vault);

    if (sources.length === 0) {
      return { ok: false, error: NO_SOURCE };
    }

    const failure = (await Promise.all(sources.map((source) => source.check()))).find(isFailure);

    return failure ?? { ok: true, value: { message: `Checking ${sources.map((source) => source.name).join(" and ")}; new PRs appear in a few seconds.` } };
  },
};

function isFailure(outcome: Outcome<void>): outcome is { ok: false; error: string } {
  return !outcome.ok;
}

async function sourcesOf(context: CommandContext, vault: string): Promise<{ name: string; check: () => Promise<Outcome<void>> }[]> {
  const ado = (await adoIntegrationProblem(context.db, vault)) === null ? [{ name: "Azure DevOps", check: () => context.powerloom.syncPullRequests(vault) }] : [];
  const github = isGitHubActive(await readGitHubSettings(context.db, vault)) ? [{ name: "GitHub", check: () => context.powerloom.syncGitHubPullRequests(vault) }] : [];

  return [...ado, ...github];
}

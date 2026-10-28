import { readRepoCommandSettings } from "@powerloom/core";
import type { BuildCommands, PowerLoomDb, localItem, workItem } from "@powerloom/db";
import { pbiWorkRepo, pbiWorkspace } from "../planning/planningWorkspace";
import type { CatalogRepoRef } from "../repos/agentRepos";
import { implementationModels, implementationSeed } from "./implementationSeed";
import { loadReviewOutcome } from "./loadReviewOutcome";
import type { PreparedImplementation } from "./models/PreparedImplementation";
import type { ReviewOutcome } from "./models/ReviewOutcome";

type ItemRow = typeof localItem.$inferSelect;
type PbiRow = typeof workItem.$inferSelect;

const NO_COMMANDS: BuildCommands = { build: null, test: null };

// What an implementation run works from: the review outcome first; only an approved plan gets the PBI branch's worktree
// (the one planning used), seeded with the run's models and the repo's build and test commands.
export async function prepareImplementation(db: PowerLoomDb, task: ItemRow, pbi: PbiRow): Promise<PreparedImplementation> {
  const outcome = await loadReviewOutcome(db, task, pbi);

  if (outcome.kind !== "approved") {
    return { outcome, workspace: null, commands: NO_COMMANDS };
  }

  const repo = await pbiWorkRepo(db, pbi);

  if (!repo) {
    return { outcome: noRepo(), workspace: null, commands: NO_COMMANDS };
  }

  const commands = repoCommands(await readRepoCommandSettings(db, pbi.vault), repo);

  return { outcome, workspace: pbiWorkspace(repo, pbi, implementationSeed(implementationModels(task.data), commands)), commands };
}

// The repo's commands by its catalogue name, matched case-insensitively like the repo names agents give.
export function repoCommands(settings: { repos: Record<string, Partial<BuildCommands>> }, repo: Pick<CatalogRepoRef, "name" | "catalogName">): BuildCommands {
  const wanted = (repo.catalogName ?? repo.name).toLowerCase();
  const entry = Object.entries(settings.repos).find(([name]) => name.toLowerCase() === wanted)?.[1] ?? {};

  return { build: entry.build || null, test: entry.test || null };
}

function noRepo(): ReviewOutcome {
  return { kind: "blocked", reason: "The PBI has no enabled repo to build in: confirm its repo, then Re-run." };
}

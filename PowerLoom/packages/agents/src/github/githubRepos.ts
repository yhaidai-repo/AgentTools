import { enabledRepos } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import { toRepoRef } from "../repos/agentRepos";
import type { GitHubRepoTarget } from "./models/GitHubRepoTarget";

// The vault's enabled GitHub repos (Settings → Repositories), named as the catalog names them; `adoProject` holds the
// owner.
export async function gitHubRepos(db: PowerLoomDb, vault: string): Promise<GitHubRepoTarget[]> {
  return (await enabledRepos(db, vault)).filter((row) => row.kind === "github").map((row) => ({ owner: row.adoProject, name: row.name, ref: toRepoRef(row) }));
}

export async function gitHubRepoNamed(db: PowerLoomDb, vault: string, name: string): Promise<GitHubRepoTarget | null> {
  const wanted = name.trim().toLowerCase();

  return (await gitHubRepos(db, vault)).find((repo) => repo.name.toLowerCase() === wanted) ?? null;
}

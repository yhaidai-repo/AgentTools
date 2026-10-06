import { repo } from "@adoa/db";
import { sql } from "drizzle-orm";
import type { SyncContext } from "./models/SyncContext";

// The vault's catalog of ADO repos, which the refinement agent picks from; `excluded` (enabled) is user-owned and never overwritten.
export async function syncRepositories(ctx: SyncContext): Promise<number> {
  const repositories = (await ctx.client.listRepositories()).filter((repository) => !repository.isDisabled);

  if (repositories.length === 0) {
    return 0;
  }

  await ctx.db
    .insert(repo)
    .values(repositories.map((repository) => ({
      id: repository.id,
      vault: ctx.vault,
      kind: "ado" as const,
      adoProject: repository.project,
      name: repository.name,
      remoteUrl: repository.remoteUrl,
      defaultBranch: repository.defaultBranch,
    })))
    .onConflictDoUpdate({
      target: repo.id,
      set: {
        adoProject: sql`excluded.ado_project`,
        name: sql`excluded.name`,
        remoteUrl: sql`excluded.remote_url`,
        defaultBranch: sql`excluded.default_branch`,
        syncedAt: new Date(),
      },
    });

  return repositories.length;
}

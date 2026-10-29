import { join } from "node:path";
import type { RestoreResult } from "@powerloom/sandbox";
import { z } from "zod";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import { defineOutsideTool } from "../outsideAccess";
import type { RunSandbox } from "./models/RunSandbox";
import type { SandboxAccess } from "./models/SandboxAccess";
import { repoSnapshot } from "./repoSnapshot";
import { failure, noSandbox, resourceOf } from "./sandboxResults";

// `dotnet add package` names the version it chose: "PackageReference for package 'Polly' version '8.4.2' added …".
const ADDED_REFERENCE = /package '[^']+' version '[^']+'/g;

// sandbox_restore (phase 3, user decision 2026-10-29: a tool the agent calls when it needs packages). It restores from
// the repo's unchanged files, sent again from the cache, never from the agent's edited copy: the restore runs the
// repo's build files with the network and the feeds' sign-ins, so an edit must not reach it.
export function restoreTool(deps: AgentDeps, context: OutsideAccessContext, access: SandboxAccess, sandbox: RunSandbox) {
  return defineOutsideTool(deps.outside, context, {
    name: "sandbox_restore",
    description: "Fetch the packages a repo declares (NuGet, npm from package-lock.json, Deno) so builds and tests can run in your offline sandbox. It restores the repo's unchanged files at the run's commit, not your edits. To use a NuGet package the repo doesn't reference yet, name it in `packages`: the restore adds it with `dotnet add package` and fetches it; then add the same PackageReference (with the version the answer shows) in your own copy, and the build finds it offline. Name a solution or project to restore only that; leave it out for the repo's root. Afterwards build as usual (packages are found offline under /packages; the vault's next runs find them there too); for npm run `npm ci --offline`.",
    input: {
      repo: z.string().min(1).describe("A repo copied in by sandbox_open"),
      target: z.string().optional().describe("A solution, project or folder of the repo, e.g. src/App.sln; leave out for the repo's root"),
      packages: z.array(z.object({
        project: z.string().min(1).describe("The project, relative to the repo's root, e.g. src/Api/Api.csproj"),
        id: z.string().min(1).describe("The NuGet package id"),
        version: z.string().optional().describe("The version; leave out for the newest"),
      })).optional().describe("NuGet packages to add to projects and fetch, before the restore"),
    },
    resource: (input) => resourceOf(access, sandbox, `restore ${input.repo}`),
    request: (input) => `restore ${input.repo}${input.target ? `/${input.target}` : ""}`,
    handler: async (input) => {
      if (!sandbox.info) {
        return noSandbox();
      }

      if (!sandbox.repos.includes(input.repo)) {
        return { text: `${input.repo} is not in your sandbox: copy it in with sandbox_open first.`, isError: true };
      }

      const snapshot = repoSnapshot(join(deps.repoCache.root, input.repo));
      const answer = await access.client.restore(sandbox.info.id, input.repo, input.target ?? "", snapshot, access.feeds, access.packageHosts, input.packages ?? []);

      markRestored(sandbox, input.repo);

      return answer.ok ? restoreText(answer.value) : failure(answer);
    },
  });
}

// Tried once is enough for the worktree shell's route, which otherwise restores before its first build.
function markRestored(sandbox: RunSandbox, repo: string): void {
  if (!sandbox.restored.includes(repo)) {
    sandbox.restored.push(repo);
  }
}

function restoreText(result: RestoreResult): OutsideToolResult {
  const steps = result.steps.map((step) => `- ${step.label}: ${step.exitCode === 0 ? "ok" : `failed (exit code ${step.exitCode})`} in ${(step.durationMs / 1000).toFixed(1)} s`);
  const failures = result.steps.filter((step) => step.exitCode !== 0).map((step) => `\n${step.label}:\n${step.output}`);
  const added = result.steps.filter((step) => step.exitCode === 0).flatMap((step) => [...step.output.matchAll(ADDED_REFERENCE)].map((match) => `- added ${match[0]}`));
  const skipped = result.skipped.map((note) => `- ${note}`);
  const lines = [result.ok ? `Restored into ${result.packagesPath}.` : "The restore did not fully succeed.", ...steps, ...added, ...skipped, ...failures];

  return { text: lines.join("\n"), isError: !result.ok, rows: result.steps.length };
}

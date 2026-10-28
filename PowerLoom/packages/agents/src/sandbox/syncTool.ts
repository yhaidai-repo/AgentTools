import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import { defineOutsideTool } from "../outsideAccess";
import type { RunSandbox } from "./models/RunSandbox";
import type { RunWorktreeSlot } from "./models/RunWorktreeSlot";
import type { SandboxAccess } from "./models/SandboxAccess";
import { snapshotOf } from "./repoSnapshot";
import { failure, noSandbox, resourceOf } from "./sandboxResults";

export const SYNC_MESSAGE = "synced from your worktree";

// sandbox_sync: the agent commits in its worktree with its own tools, and builds and tests only in the sandbox, so the
// sandbox copy must catch up with each wave of commits. The service replaces the repo's folder whole (files that
// disappeared go too); the packages volume under /packages is not in it and stays.
export function syncTool(deps: AgentDeps, context: OutsideAccessContext, access: SandboxAccess, sandbox: RunSandbox, slot: RunWorktreeSlot) {
  return defineOutsideTool(deps.outside, context, {
    name: "sandbox_sync",
    description: `Copy your worktree's current files over its repo's folder /workspace/<repo> in your sandbox, so it builds what you committed. Call it after each wave of commits, before building or testing. Files you deleted disappear from the sandbox; anything made inside /workspace/<repo> (build output, node_modules, sandbox-only edits) is reset, while restored packages under /packages stay: build again, and for npm run \`npm ci --offline\` again. Afterwards git status / git diff in the sandbox show changes since this sync.`,
    input: {},
    resource: () => resourceOf(access, sandbox, `sync ${slot.current?.repo ?? ""}`.trim()),
    request: () => `sync ${slot.current?.repo ?? ""}`.trim(),
    handler: async () => {
      const worktree = slot.current;

      if (!worktree) {
        return { text: "Your run has no worktree: there is nothing to sync.", isError: true };
      }

      if (!sandbox.info) {
        return noSandbox();
      }

      if (!sandbox.repos.includes(worktree.repo)) {
        return { text: `${worktree.repo} is not in your sandbox: copy it in with sandbox_open first.`, isError: true };
      }

      const snapshot = snapshotOf(deps.repoCache.root, worktree, worktree.repo);
      const answer = await access.client.uploadRepo(sandbox.info.id, worktree.repo, snapshot, SYNC_MESSAGE);

      return answer.ok ? { text: `Synced ${answer.value.files} files into ${answer.value.path}.`, rows: answer.value.files } : failure(answer);
    },
  });
}

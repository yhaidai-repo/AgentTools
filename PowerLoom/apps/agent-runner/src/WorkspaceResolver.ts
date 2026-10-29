import type { RunShellRouteSlot, RunWorktreeSlot } from "@powerloom/agents";
import type { AgentRequest, AgentWorkspace } from "@agenttools/runtime";
import { join } from "node:path";
import { identityEnv } from "./GsdWorktreePreparer";
import type { GitIdentityEnv } from "./models/GitIdentityEnv";
import type { GsdPreparer } from "./models/GsdPreparer";
import type { ResolvedWorkspace } from "./models/ResolvedWorkspace";
import type { WorkspaceOptions } from "./models/WorkspaceOptions";
import type { WorkspaceRepos } from "./models/WorkspaceRepos";

// GSD's installer writes its hooks and permissions to settings.local.json, which the "project" source alone never reads.
const GSD_SETTING_SOURCES: AgentRequest["settingSources"] = ["project", "local"];

// Turns a request's workspace into the folder, settings and environment the runtime runs it with, and tells the run's
// sandbox tools (`runWorktree`) which worktree is the run's until the run ends. The route the sandbox tools leave
// (`shellRoute`) sends the worktree shell's builds and tests to the run's sandbox.
export class WorkspaceResolver {
  constructor(private readonly repos: WorkspaceRepos, private readonly gsd: GsdPreparer, private readonly options: WorkspaceOptions, private readonly runWorktree: RunWorktreeSlot, private readonly shellRoute: RunShellRouteSlot) {}

  async resolve(request: AgentRequest): Promise<ResolvedWorkspace> {
    const workspace = request.workspace;

    if (!workspace) {
      return { request, release: () => {} };
    }

    const worktree = this.worktreePath(workspace);

    await this.repos.acquire([workspace.repo]);

    // A failed preparation gives the repo back at once: the run never starts, so nothing else would.
    try {
      const env = await this.openWorktree(workspace, worktree);

      this.runWorktree.current = { repo: workspace.repo.name, path: worktree };

      return { request: inWorktree(request, worktree, env, this.shellRoute), release: () => this.release(workspace) };
    } catch (error) {
      this.repos.release([workspace.repo]);
      throw error;
    }
  }

  private release(workspace: AgentWorkspace): void {
    this.runWorktree.current = null;
    this.repos.release([workspace.repo]);
  }

  private async openWorktree(workspace: AgentWorkspace, worktree: string): Promise<GitIdentityEnv> {
    await this.repos.openBranchWorktree(workspace.repo, workspace.baseBranch, workspace.branch, worktree);

    return workspace.gsd ? this.prepareGsd(worktree, workspace) : identityEnv(this.options.identity);
  }

  private prepareGsd(worktree: string, workspace: AgentWorkspace): Promise<GitIdentityEnv> {
    if (!this.options.gsdCore) {
      throw new Error("The run asks for a GSD workspace, but the runner has no GSD (GSD_CORE_DIR is not set).");
    }

    return this.gsd.prepare({ worktree, gsdCore: this.options.gsdCore, identity: this.options.identity, seed: workspace.gsdSeed });
  }

  // One worktree per repo and branch, so a PBI's planning run and implementation run share it.
  private worktreePath(workspace: AgentWorkspace): string {
    return join(this.options.worktreeRoot, workspace.repo.name, workspace.branch.replace(/[^\w.-]+/g, "-"));
  }
}

function inWorktree(request: AgentRequest, worktree: string, env: GitIdentityEnv, shellRoute: RunShellRouteSlot): AgentRequest {
  const settingSources = request.workspace?.gsd ? GSD_SETTING_SOURCES : request.settingSources;
  const route = shellRoute.current ? { shellRoute: shellRoute.current } : {};

  return { ...request, cwd: worktree, settingSources, env: { ...request.env, ...env }, ...route };
}

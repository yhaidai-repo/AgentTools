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

// Turns a request's workspace into the folder, settings and environment the runtime runs it with.
export class WorkspaceResolver {
  constructor(private readonly repos: WorkspaceRepos, private readonly gsd: GsdPreparer, private readonly options: WorkspaceOptions) {}

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

      return { request: inWorktree(request, worktree, env), release: () => this.repos.release([workspace.repo]) };
    } catch (error) {
      this.repos.release([workspace.repo]);
      throw error;
    }
  }

  private async openWorktree(workspace: AgentWorkspace, worktree: string): Promise<GitIdentityEnv> {
    await this.repos.openBranchWorktree(workspace.repo, workspace.baseBranch, workspace.branch, worktree);

    return workspace.gsd ? this.prepareGsd(worktree) : identityEnv(this.options.identity);
  }

  private prepareGsd(worktree: string): Promise<GitIdentityEnv> {
    if (!this.options.gsdCore) {
      throw new Error("The run asks for a GSD workspace, but the runner has no GSD (GSD_CORE_DIR is not set).");
    }

    return this.gsd.prepare({ worktree, gsdCore: this.options.gsdCore, identity: this.options.identity });
  }

  // One worktree per repo and branch, so a PBI's planning run and implementation run share it.
  private worktreePath(workspace: AgentWorkspace): string {
    return join(this.options.worktreeRoot, workspace.repo.name, workspace.branch.replace(/[^\w.-]+/g, "-"));
  }
}

function inWorktree(request: AgentRequest, worktree: string, env: GitIdentityEnv): AgentRequest {
  const settingSources = request.workspace?.gsd ? GSD_SETTING_SOURCES : request.settingSources;

  return { ...request, cwd: worktree, settingSources, env: { ...request.env, ...env } };
}

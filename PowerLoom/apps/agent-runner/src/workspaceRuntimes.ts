import { RuntimeRegistry } from "@agenttools/runtime";
import { WorkspaceRuntime } from "./WorkspaceRuntime";
import type { WorkspaceResolver } from "./WorkspaceResolver";

// The same runtimes for one run, each resolving the request's workspace first.
export function workspaceRuntimes(runtimes: RuntimeRegistry, workspaces: WorkspaceResolver): RuntimeRegistry {
  const wrapped = new RuntimeRegistry();

  for (const provider of runtimes.providers()) {
    wrapped.register(new WorkspaceRuntime(runtimes.get(provider), workspaces));
  }

  return wrapped;
}

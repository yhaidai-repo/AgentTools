export interface SandboxInfo {
  id: string;
  owner: string;
  expiresAt: string;
  /** The writable folder the repos are copied into, e.g. /workspace. */
  workspace: string;
  image: string;
  /** What the image holds, from its `powerloom.toolchains` label; empty when it has none. */
  toolchains: string;
}

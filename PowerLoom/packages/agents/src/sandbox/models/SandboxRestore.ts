// One sandbox_restore of the run (called by the agent or by the shell's route before its first build): the repo, whether
// every step worked, and when.
export interface SandboxRestore {
  repo: string;
  ok: boolean;
  at: string;
}

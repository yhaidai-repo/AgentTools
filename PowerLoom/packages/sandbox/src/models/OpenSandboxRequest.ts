export interface OpenSandboxRequest {
  /** Who it belongs to: `powerloom-run-<id>`; the run's end removes it by this name. */
  owner: string;
  /** The service removes it after this long, whatever happens to the run. */
  ttlMinutes: number;
}

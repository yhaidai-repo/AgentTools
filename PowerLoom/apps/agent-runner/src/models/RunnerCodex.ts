import type { CodexDeviceLogin, CodexHome } from "@powerloom/agents";

/** PowerLoom's Codex home and its sign-in; the runner has none without CODEX_HOME. */
export interface RunnerCodex {
  home: CodexHome;
  login: CodexDeviceLogin;
}

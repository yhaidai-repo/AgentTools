import type { AgentEvent } from "@agenttools/runtime";

// `observe`: the run's observer, shown the SDK's own web calls. `withDrafts`: false when the earlier run already saved
// its output, so its draft calls aren't made again.
export interface ReplayOptions {
  observe?: (event: AgentEvent) => void;
  withDrafts: boolean;
}

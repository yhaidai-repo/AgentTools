import type { AgentRunSession } from "../../AgentRunSession";
import type { RepoAccess } from "../../models/RepoAccess";

// What a writer gets while the run is prepared: the run, the repos opened for it, the session for its traced phases.
export interface WriterRunContext {
  runId: number;
  repos: RepoAccess;
  session: AgentRunSession;
}

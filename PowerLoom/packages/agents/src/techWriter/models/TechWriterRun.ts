import type { RepoAccess } from "../../models/RepoAccess";
import type { TechWriterDraft } from "./TechWriterDraft";

// State one tech-writer run builds up while preparing and running; the repos are released when the run ends.
export interface TechWriterRun {
  repos: RepoAccess;
  draft: TechWriterDraft;
}

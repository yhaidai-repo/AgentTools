import type { RunBuildLog } from "../../sandbox/models/RunBuildLog";
import type { BuildPlace } from "./BuildPlace";
import type { BuildSource } from "./BuildSource";

// Where the run builds, once it knows: its worktree's source, the place the build is recorded under, and the builds and
// tests (and restores) its sandbox ran so far.
export interface BuildTarget {
  source: BuildSource;
  place: BuildPlace;
  buildLog: RunBuildLog;
}

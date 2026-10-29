import type { SandboxBuildRun } from "../../sandbox/models/SandboxBuildRun";
import type { BuildPlace } from "./BuildPlace";
import type { BuildSource } from "./BuildSource";

// Where the run builds, once it knows: its worktree's source, the place the build is recorded under, and the builds and
// tests its sandbox ran so far.
export interface BuildTarget {
  source: BuildSource;
  place: BuildPlace;
  buildRuns: SandboxBuildRun[];
}

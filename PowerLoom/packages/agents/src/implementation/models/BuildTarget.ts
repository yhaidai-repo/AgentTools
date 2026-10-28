import type { BuildPlace } from "./BuildPlace";
import type { BuildSource } from "./BuildSource";

// Where the run builds, once it knows: its worktree's source and the place the build is recorded under.
export interface BuildTarget {
  source: BuildSource;
  place: BuildPlace;
}

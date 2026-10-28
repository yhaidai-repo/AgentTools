import type { RepoProbe } from "./RepoProbe";
import type { RestorePlan } from "./RestorePlan";

// One ecosystem's restore: what it runs for the files the probe found. A new ecosystem is a new Restorer.
export interface Restorer {
  plan(probe: RepoProbe): RestorePlan;
}

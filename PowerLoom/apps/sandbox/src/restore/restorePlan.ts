import type { RepoProbe } from "../models/RepoProbe";
import type { RestorePlan } from "../models/RestorePlan";
import type { Restorer } from "../models/Restorer";
import { DenoRestorer } from "./DenoRestorer";
import { DotnetRestorer } from "./DotnetRestorer";
import { NpmRestorer } from "./NpmRestorer";
import { RepoRestoreOverride } from "./RepoRestoreOverride";

const RESTORERS: Restorer[] = [new DotnetRestorer(), new NpmRestorer(), new DenoRestorer()];
const OVERRIDE = new RepoRestoreOverride();

/** What a restore runs for the probed folder: the repo's own commands when it has them, else every ecosystem found. */
export function restorePlanOf(probe: RepoProbe): RestorePlan {
  if (OVERRIDE.applies(probe)) {
    return OVERRIDE.plan(probe);
  }

  const plans = [OVERRIDE, ...RESTORERS].map((restorer) => restorer.plan(probe));

  return { steps: plans.flatMap((plan) => plan.steps), skipped: plans.flatMap((plan) => plan.skipped) };
}

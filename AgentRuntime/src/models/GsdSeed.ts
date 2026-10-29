import type { GsdSeedFile } from "./GsdSeedFile";

// What a GSD run starts from besides GSD itself: settings merged into .planning/config.json (model profiles, workflow
// switches) and files written into .planning/ (the task's context), all before the run's first GSD command.
export interface GsdSeed {
  config: Record<string, unknown>;
  files: GsdSeedFile[];
}

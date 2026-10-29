import type { BuildCheck } from "./BuildCheck";

// What the run's sandbox last built and tested before write_implementation saved the build; null for one never run.
export interface BuildChecks {
  build: BuildCheck | null;
  test: BuildCheck | null;
}

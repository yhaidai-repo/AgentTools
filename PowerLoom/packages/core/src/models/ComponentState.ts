import type { StateLevel } from "./StateLevel";

// One component's state with a line of detail (e.g. Postgres).
export interface ComponentState {
  state: StateLevel;
  detail: string;
}

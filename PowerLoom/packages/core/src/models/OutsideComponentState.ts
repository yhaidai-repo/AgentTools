import type { StateLevel } from "./StateLevel";

// An outside system the agents read (SQL, Azure, Confluence) and whether it answers.
export interface OutsideComponentState {
  component: string;
  tool: string;
  state: StateLevel;
  detail: string;
}

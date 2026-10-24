import type { StateLevel } from "./StateLevel";

// One thing PowerLoom's status asks the person to look at.
export interface Attention {
  component: string;
  severity: StateLevel;
  message: string;
}

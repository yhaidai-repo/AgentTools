import type { WwwRecord } from "@adoa/vault";
import type { ProjectRegisterRecord } from "./ProjectRegisterRecord";

// A vault's maintenance records: its What-went-wrong log and every project's registers.
export interface VaultRegisters {
  www: WwwRecord[];
  issues: ProjectRegisterRecord[];
  questions: ProjectRegisterRecord[];
}

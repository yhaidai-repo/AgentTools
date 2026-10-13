import type { Evidence } from "../../models/Evidence";

// One option a spike or investigation found; the next step chooses, research doesn't.
export interface SpikeOption {
  option: string;
  pros: string;
  cons: string;
  evidence: Evidence[];
}

import type { HandoffStatus } from "@powerloom/db";
import type { NewHandoff } from "./NewHandoff";

// A stored hand-off with its target's state: how a person or agent closed the item it created.
export interface HandoffView extends NewHandoff {
  id: number;
  toItemId: string;
  status: HandoffStatus;
  createdAt: Date;
  closedAt: Date | null;
  targetStatus: string;
  targetResolution: string | null;
}

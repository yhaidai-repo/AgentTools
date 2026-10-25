import type { OfferedTool } from "./OfferedTool";

/** The tools one agent's latest run in a vault was given (or the latest chat session's, holder "chat"), and when. */
export interface ToolOffer {
  holder: string;
  offeredAt: string;
  tools: OfferedTool[];
}

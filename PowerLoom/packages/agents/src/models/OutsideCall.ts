import type { OutsideResource } from "./OutsideResource";
import type { OutsideToolResult } from "./OutsideToolResult";

// One finished call to an outside system, as its data access log row is written: the tool's or the step's name, where
// it went, the request as sent and what came back.
export interface OutsideCall {
  tool: string;
  resource: OutsideResource;
  request: string;
  result: OutsideToolResult;
  startedAt: Date;
}

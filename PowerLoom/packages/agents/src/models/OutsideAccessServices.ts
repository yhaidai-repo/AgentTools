import type { AccessRequests } from "../AccessRequests";
import type { DataAccessLog } from "../DataAccessLog";

// What every outside tool's wrapper needs: the log for each call, and the access requests for a denied one.
export interface OutsideAccessServices {
  log: DataAccessLog;
  requests: Pick<AccessRequests, "request">;
}

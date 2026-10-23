import type { Attention } from "./Attention";
import type { BudgetStatus } from "./BudgetStatus";
import type { ComponentState } from "./ComponentState";
import type { MessagingStatus } from "./MessagingStatus";
import type { OutsideComponentState } from "./OutsideComponentState";
import type { RunInProgress } from "./RunInProgress";
import type { RunnerStatus } from "./RunnerStatus";
import type { ScheduleStatus } from "./ScheduleStatus";
import type { SyncRun } from "./SyncRun";
import type { TickerStatus } from "./TickerStatus";
import type { VaultStatus } from "./VaultStatus";

// PowerLoom's view of the running system (GET /api/status): the fields the dashboard reads. The web's own client type
// carries the rest (the cleanup reports); `checkedAt` is an ISO string as the API sends it.
export interface SystemStatus {
  checkedAt: string;
  database: ComponentState;
  ticker: TickerStatus;
  runner: RunnerStatus;
  confluenceConfigured: boolean;
  vaults: VaultStatus[];
  messaging: MessagingStatus;
  runs: RunInProgress[];
  schedules: ScheduleStatus[];
  recentSyncs: SyncRun[];
  budget: BudgetStatus;
  outside: OutsideComponentState[];
  attention: Attention[];
}

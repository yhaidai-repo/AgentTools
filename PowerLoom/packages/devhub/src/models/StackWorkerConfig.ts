// The fields of one background worker a stack changes (PVS WorkerConfig): Cron is a cron expression or a number of
// seconds; RunAtStart runs it once as the host starts.
export interface StackWorkerConfig {
  RunAtStart?: boolean;
  Cron?: string;
  DegreeOfParallelism?: number;
}

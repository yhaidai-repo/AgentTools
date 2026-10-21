// One service of the running stack. workers: the background workers the stack's config enabled (null for a service
// without a worker configuration).
export interface StackServiceState {
  name: string;
  running: boolean;
  url: string | null;
  log: string | null;
  errorLog: string | null;
  workers?: string[] | null;
}

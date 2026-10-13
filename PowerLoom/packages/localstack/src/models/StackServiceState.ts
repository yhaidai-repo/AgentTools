// One service of the running stack.
export interface StackServiceState {
  name: string;
  running: boolean;
  url: string | null;
  log: string | null;
  errorLog: string | null;
}

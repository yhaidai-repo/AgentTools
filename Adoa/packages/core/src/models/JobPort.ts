// How a command hands work to the worker (pg-boss for the web; an MCP server can use the same queues).
export interface JobPort {
  send(queue: string, data: object): Promise<string | null>;
  // Sends and waits until the worker finished the job; true when it completed within timeoutMs.
  sendAndWait(queue: string, data: object, timeoutMs: number): Promise<boolean>;
}

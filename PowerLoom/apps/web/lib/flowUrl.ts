// The Flow app's address as the browser sees it (FLOW_URL; 127.0.0.1 so the vault cookie is shared): the header's link
// and the flow tag on a task.
export function flowUrl(): string {
  return (process.env.FLOW_URL ?? "http://127.0.0.1:3120").replace(/\/$/, "");
}

export function flowExecutionUrl(executionId: string): string {
  return `${flowUrl()}/executions/${encodeURIComponent(executionId)}`;
}

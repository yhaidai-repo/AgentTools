const OPEN_STATUSES = ["open", "in-progress"];

export function isOpen(item: { status: string }): boolean {
  return OPEN_STATUSES.includes(item.status);
}

// What runs produce (research results, test reports): shown with their task, never as tasks.
export const RESULT_KINDS: ("research-result" | "test-report" | "support-guide-result")[] = ["research-result", "test-report", "support-guide-result"];

export function isResultKind(kind: string): boolean {
  return (RESULT_KINDS as string[]).includes(kind);
}

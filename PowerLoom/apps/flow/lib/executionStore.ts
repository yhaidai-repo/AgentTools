import type { ExecutionRecord } from "@/models/ExecutionRecord";

// The mocked executions of this browser session (sessionStorage): the /executions page lists them.
const KEY = "powerloom-flow.executions";
const EVENT = "powerloom-flow:executions";

export function listExecutions(): ExecutionRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(KEY);

    return raw ? (JSON.parse(raw) as ExecutionRecord[]) : [];
  } catch {
    return [];
  }
}

export function upsertExecution(record: ExecutionRecord): void {
  const others = listExecutions().filter((other) => other.id !== record.id);

  window.sessionStorage.setItem(KEY, JSON.stringify([record, ...others].sort((a, b) => b.startedAt.localeCompare(a.startedAt))));
  window.dispatchEvent(new Event(EVENT));
}

export function clearExecutions(): void {
  window.sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function onExecutionsChange(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

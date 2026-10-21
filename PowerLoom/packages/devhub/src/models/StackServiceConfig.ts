import type { StackWorkerConfig } from "./StackWorkerConfig";

// What a stack sets for one configurable service. workers: the background host's Coravel workers to run, each with
// the WorkerConfig fields to change; the host runs no other worker.
export interface StackServiceConfig {
  workers?: Record<string, StackWorkerConfig>;
}

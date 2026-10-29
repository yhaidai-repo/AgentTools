import type { Outcome } from "./Outcome";

export interface PerformanceHistory {
  from: string; to: string; intervalSeconds: number;
  points: { at: string; requestsPerMinute: number | null; averageLatencyMs: number | null; workingSetBytes: number | null; observedMinutes: number }[];
}
export interface TelemetryPage<T> { state: string; message: string | null; items: T[]; truncated: boolean; scanned: number }
export interface TelemetryLog { at: string; service: string; severity: string; traceId: string | null; spanId: string | null; body: string; attributes: Record<string, string> }
export interface TelemetrySpan {
  traceId: string; spanId: string; parentSpanId: string | null; service: string; name: string; at: string; durationMs: number; hasError: boolean; statusMessage: string | null;
  attributes: Record<string, string>; events: { name: string; at: string; attributes: Record<string, string> }[];
}
export interface TelemetryTrace { traceId: string; name: string; at: string; durationMs: number; hasError: boolean; spanCount: number; services: string[] }
export interface TelemetryLogsInput { hours: number; service?: string; severity?: "Trace" | "Debug" | "Information" | "Warning" | "Error" | "Critical"; traceId?: string; search?: string; limit: number }
export interface TelemetryTracesInput { hours: number; service?: string; errorsOnly: boolean; minDurationMs: number; search?: string; limit: number }

export interface DiagnosticsPort {
  performance(hours: number): Promise<Outcome<PerformanceHistory>>;
  telemetryLogs(input: TelemetryLogsInput): Promise<Outcome<TelemetryPage<TelemetryLog>>>;
  telemetryTraces(input: TelemetryTracesInput): Promise<Outcome<TelemetryPage<TelemetryTrace>>>;
  telemetryTrace(traceId: string, limit: number): Promise<Outcome<TelemetryPage<TelemetrySpan>>>;
}

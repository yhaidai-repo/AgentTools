import { z } from "zod";
import type { Command } from "../models/Command";
import type { PerformanceHistory, TelemetryLogsInput, TelemetryTracesInput, TelemetryPage, TelemetryLog, TelemetryTrace, TelemetrySpan } from "../models/DiagnosticsPort";
import { limitInput } from "./inputs";

const hours = z.number().int().min(1).max(24).default(1).describe("Look back 1–24 hours; results cover retained data only");
const service = z.string().trim().min(1).max(200).optional().describe("Exact telemetry service/resource name, for example PowerLoom");
const search = z.string().trim().min(1).max(200).optional().describe("Case-insensitive text within the recent scanned results");
const traceId = z.string().regex(/^(?!0{32}$)[a-f0-9]{32}$/i).describe("Distributed trace ID: 32 hexadecimal digits, from telemetry_logs or traces_list; not a RUN ID");

export const readPerformanceCommand: Command<{ hours: number }, PerformanceHistory> = {
  name: "performance.read", effect: "read",
  description: "Read the backend API's native performance chart history: requests/minute, average response time in ms, and sampled process working-set memory in bytes, in five-minute intervals. Null values are gaps, not zeros. Up to 24 hours of saved data, available even when Aspire diagnostics are disabled.",
  input: z.object({ hours: hours.default(24) }),
  run: (context, input) => context.powerloom.performance(input.hours),
};

export const readTelemetryLogsCommand: Command<TelemetryLogsInput, TelemetryPage<TelemetryLog>> = {
  name: "telemetry.logs", effect: "read",
  description: "Inspect Aspire's structured diagnostic logs, with trace/span IDs and abbreviated attributes. Read-only; never starts Aspire. Disabled/unavailable diagnostics return an explicit error. Filters apply to up to 500 recent logs after service, minimum severity and trace filtering; truncated means narrow the filters. For stored warnings/errors without Aspire use logs_read; agent steps use run_events.",
  input: z.object({ hours, service, severity: z.enum(["Trace", "Debug", "Information", "Warning", "Error", "Critical"]).optional().describe("Minimum severity, inclusive"), traceId: traceId.optional(), search, limit: limitInput(100, 25) }),
  run: (context, input) => context.powerloom.telemetryLogs(input),
};

export const listTelemetryTracesCommand: Command<TelemetryTracesInput, TelemetryPage<TelemetryTrace>> = {
  name: "traces.list", effect: "read",
  description: "Find slow or failed distributed application requests in Aspire, with trace IDs, duration, errors, span count and services. This is different from an agent's run_events. Read-only; never starts Aspire. Filters apply to up to 100 recent traces after service/error filtering; truncated means incomplete coverage. Use trace_get to inspect operations in one trace.",
  input: z.object({ hours, service, errorsOnly: z.boolean().default(false), minDurationMs: z.number().min(0).max(3600000).default(0), search, limit: limitInput(50, 20) }),
  run: (context, input) => context.powerloom.telemetryTraces(input),
};

export const getTelemetryTraceCommand: Command<{ traceId: string; limit: number }, TelemetryPage<TelemetrySpan>> = {
  name: "trace.get", effect: "read",
  description: "Inspect one retained distributed trace: operations (spans), parent relationships, service, duration, errors, abbreviated attributes and up to three events per span. Read-only; never starts Aspire. Missing/disabled/unavailable diagnostics return explicit errors. Output is bounded; truncated means this is a partial trace.",
  input: z.object({ traceId, limit: limitInput(200, 100) }),
  run: (context, input) => context.powerloom.telemetryTrace(input.traceId, input.limit),
};

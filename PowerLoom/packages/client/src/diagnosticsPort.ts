import type { DiagnosticsPort, Outcome, TelemetryPage } from "@powerloom/core";
import type { PowerLoomClient } from "./createPowerLoomClient";
import { powerloomFailure } from "./powerloomFailure";

export function diagnosticsPort(client: PowerLoomClient): DiagnosticsPort {
  return {
    async performance(hours) {
      const result = await read(() => client.GET("/api/status/performance", { cache: "no-store" }));
      if (!result.ok) return result;
      const history = result.value;
      const from = new Date(new Date(history.to).getTime() - hours * 3600000).toISOString();
      return { ok: true, value: { ...history, from, points: history.points.filter(point => new Date(point.at).getTime() + history.intervalSeconds * 1000 > Date.parse(from)) } };
    },
    async telemetryLogs(input) {
      return ready(await read(() => client.GET("/api/status/telemetry/logs", { params: { query: { ...input, resource: input.service } }, cache: "no-store" })));
    },
    async telemetryTraces(input) {
      return ready(await read(() => client.GET("/api/status/telemetry/traces", { params: { query: { ...input, resource: input.service } }, cache: "no-store" })));
    },
    async telemetryTrace(traceId, limit) {
      return ready(await read(() => client.GET("/api/status/telemetry/traces/{traceId}", { params: { path: { traceId }, query: { limit } }, cache: "no-store" })));
    },
  };
}

async function read<T>(request: () => Promise<{ data?: T; error?: unknown; response: Response }>): Promise<Outcome<T>> {
  try {
    const { data, error, response } = await request();
    return data && response.ok ? { ok: true, value: data } : powerloomFailure(error, response);
  } catch {
    return { ok: false, error: "PowerLoom diagnostics API is unavailable." };
  }
}

function ready<T>(result: Outcome<TelemetryPage<T>>): Outcome<TelemetryPage<T>> {
  return !result.ok || result.value.state === "ready" ? result : { ok: false, error: result.value.message ?? `Diagnostics ${result.value.state}.` };
}

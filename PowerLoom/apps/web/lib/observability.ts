import type { ObservabilityState } from "@/models/ObservabilityState";

// Compose supplies the internal dashboard URL only when telemetry export is configured.
export function isObservabilityOn(): boolean {
  return Boolean(process.env.TELEMETRY_INTERNAL_URL?.trim());
}

export function telemetryDashboardUrl(): string | null {
  return process.env.TELEMETRY_URL?.trim().replace(/\/+$/, "") || null;
}

export async function loadObservabilityState(fetcher: typeof fetch = fetch): Promise<ObservabilityState> {
  if (!isObservabilityOn()) return "off";

  try {
    const url = process.env.TELEMETRY_INTERNAL_URL!.trim().replace(/\/+$/, "");
    const response = await fetcher(url, { signal: AbortSignal.timeout(2_000), cache: "no-store" });
    return observabilityState(true, response.ok);
  } catch {
    return "no answer";
  }
}

export function observabilityState(isOn: boolean, answers: boolean): ObservabilityState {
  if (!isOn) {
    return "off";
  }

  return answers ? "answers" : "no answer";
}

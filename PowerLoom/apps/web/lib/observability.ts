import type { ObservabilityState } from "@/models/ObservabilityState";

// otel-lgtm is for development only (user decision 2026-10-24: its image is about 1 GB): it runs when .env switches on
// the `observability` compose profile and gives the web PROMETHEUS_URL.
export function isObservabilityOn(): boolean {
  return Boolean(process.env.PROMETHEUS_URL?.trim());
}

export function observabilityState(isOn: boolean, answers: boolean): ObservabilityState {
  if (!isOn) {
    return "off";
  }

  return answers ? "answers" : "no answer";
}

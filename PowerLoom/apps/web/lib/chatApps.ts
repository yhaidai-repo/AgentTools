import type { ChatApps } from "@/lib/aiProviders";

// The chat app picker offers connected apps, plus the chosen one so the form never changes it silently.
export function choosableApps(apps: ChatApps): ChatApps["apps"] {
  return apps.apps.filter((app) => app.connected || app.id === apps.current);
}

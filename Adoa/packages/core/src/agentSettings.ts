import { config, type AdoaDb } from "@adoa/db";
import { eq } from "drizzle-orm";
import type { AgentSettings } from "./models/AgentSettings";

const AGENTS_KEY = "agents";

// Defaults approved by the user (2026-10-01); every value is editable in Settings.
export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  paused: false,
  pausedUntil: null,
  dailyBudgetUsd: 10,
  refinement: {
    enabled: true,
    cron: "0 * * * *",
    batchSize: 2,
    provider: "anthropic",
    model: "claude-sonnet-5",
    maxTurns: 40,
    timeoutMinutes: 10,
    perRunBudgetUsd: 1,
    dailyBudgetUsd: 5,
    skills: ["adoa-refinement-checklist"],
    maxFailures: 3,
  },
};

export async function readAgentSettings(db: AdoaDb): Promise<AgentSettings> {
  const [row] = await db.select().from(config).where(eq(config.key, AGENTS_KEY));
  const stored = (row?.value ?? {}) as Partial<AgentSettings>;

  return {
    ...DEFAULT_AGENT_SETTINGS,
    ...stored,
    refinement: { ...DEFAULT_AGENT_SETTINGS.refinement, ...stored.refinement },
  };
}

export async function saveAgentSettings(db: AdoaDb, settings: AgentSettings): Promise<void> {
  await db
    .insert(config)
    .values({ key: AGENTS_KEY, value: settings })
    .onConflictDoUpdate({ target: config.key, set: { value: settings, updatedAt: new Date() } });
}

export function isAgentsPaused(settings: AgentSettings, now = new Date()): boolean {
  return settings.paused || (settings.pausedUntil !== null && new Date(settings.pausedUntil) > now);
}

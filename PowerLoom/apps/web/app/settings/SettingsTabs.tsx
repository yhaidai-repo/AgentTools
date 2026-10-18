import Link from "next/link";
import type { SettingsTabMark } from "@/models/SettingsTabMark";

export const SETTINGS_TABS = [
  { key: "ado", label: "Azure DevOps" },
  { key: "sync", label: "Sync" },
  { key: "repos", label: "Repositories" },
  { key: "data", label: "Data access" },
  { key: "devhub", label: "DevHub" },
  { key: "agents", label: "Agents" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["key"];

// One tab per area instead of one long page (user decision 2026-10-18); a tab's dot says whether its feature is on, and
// pulses amber when something there needs a look.
export function SettingsTabs({ active, marks }: { active: SettingsTab; marks: Partial<Record<SettingsTab, SettingsTabMark>> }) {
  return (
    <nav className="tabs settings-tabs">
      {SETTINGS_TABS.map((tab) => (
        <Link key={tab.key} href={`/settings?tab=${tab.key}`} className={tab.key === active ? "active" : undefined}>
          {marks[tab.key]?.dot && <span className={`dot ${marks[tab.key]?.dot}`} />}
          {tab.label}
          {marks[tab.key]?.count && <b className="seg-count">{marks[tab.key]?.count}</b>}
        </Link>
      ))}
    </nav>
  );
}

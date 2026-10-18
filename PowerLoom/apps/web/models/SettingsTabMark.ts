// What a Settings tab shows beside its name: a dot (ok = on, warn = needs a look, off) and a count (e.g. "18/28").
export interface SettingsTabMark {
  dot?: "ok" | "warn" | "off";
  count?: string;
}

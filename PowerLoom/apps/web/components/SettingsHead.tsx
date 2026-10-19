import type { ReactNode } from "react";

interface SettingsHeadProps {
  title: string;
  description?: ReactNode;
  /** The feature's switch, posted with its form as `enabled`; none for a card without one. */
  enabled?: boolean;
  /** Saves the switch as soon as it flips (a card whose switch is its own form). */
  onToggle?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

// A settings card's head (user decision 2026-10-18): its title, the feature's switch on the right, and one line on what
// it does. While the switch is off the card's body dims (CSS).
export function SettingsHead({ title, description, enabled, onToggle }: SettingsHeadProps) {
  return (
    <div className="settings-head">
      <h3>{title}</h3>
      {enabled !== undefined && (
        <label className="head-switch" title={enabled ? "On" : "Off"}>
          <input type="checkbox" name="enabled" defaultChecked={enabled} onChange={onToggle} aria-label={`${title} enabled`} />
          <span className="switch-knob" aria-hidden="true" />
        </label>
      )}
      {description && <p>{description}</p>}
    </div>
  );
}

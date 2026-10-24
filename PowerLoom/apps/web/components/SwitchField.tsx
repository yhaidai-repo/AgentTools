import type { ReactNode } from "react";

interface SwitchFieldProps {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  defaultChecked: boolean;
  value?: string;
}

// A checkbox drawn as a switch with a one-line hint under its label (user decision 2026-10-18: no paragraph-long
// checkbox labels); it posts like any checkbox.
export function SwitchField({ name, label, hint, defaultChecked, value }: SwitchFieldProps) {
  return (
    <label className="switch-field">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} />
      <span className="switch-knob" aria-hidden="true" />
      <span className="switch-text">{label}{hint && <small>{hint}</small>}</span>
    </label>
  );
}

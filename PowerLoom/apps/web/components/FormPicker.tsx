"use client";

import { useState } from "react";
import { Dropdown } from "@/components/Dropdown";
import type { PickerOption } from "@/models/PickerOption";

interface FormPickerProps {
  /** The form field the choice posts as. */
  name: string;
  /** The button's accessible name. */
  label: string;
  value: string;
  options: PickerOption[];
}

// A form field picked from the shared dropdown (user, 2026-10-18: no unstyled system lists); the choice posts through
// a hidden input, so the form's action reads it as before.
export function FormPicker({ name, label, value, options }: FormPickerProps) {
  const [chosen, setChosen] = useState(value);
  const current = options.find((option) => option.value === chosen);

  return (
    <div className="form-picker">
      <input type="hidden" name={name} value={chosen} />
      <Dropdown label={label} pill trigger={<span>{current?.label ?? chosen}</span>}>
        {options.map((option) => (
          <button key={option.value} type="button" className={`menu-item${option.value === chosen ? " current" : ""}`} role="menuitem" onClick={() => setChosen(option.value)}>
            <span className="menu-text">{option.label}{option.note && <small>{option.note}</small>}</span>
            {option.value === chosen && <span className="menu-check" aria-label="current">✓</span>}
          </button>
        ))}
      </Dropdown>
    </div>
  );
}

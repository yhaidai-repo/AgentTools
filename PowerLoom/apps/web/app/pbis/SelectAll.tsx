"use client";

import type { ChangeEvent } from "react";

// Ticks or unticks every row of the page; the form's change handler then shows or hides the selection bar.
export function SelectAll() {
  function onChange(event: ChangeEvent<HTMLInputElement>): void {
    const form = event.currentTarget.form;
    const checked = event.currentTarget.checked;

    form?.querySelectorAll<HTMLInputElement>('input[name="adoId"]').forEach((box) => setChecked(box, checked));
  }

  return <input type="checkbox" aria-label="Select all on this page" onChange={onChange} />;
}

function setChecked(box: HTMLInputElement, checked: boolean): void {
  box.checked = checked;
}

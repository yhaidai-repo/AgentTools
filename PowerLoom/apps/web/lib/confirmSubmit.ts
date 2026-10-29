import type { FormEvent, MouseEvent } from "react";
import { confirmDialog } from "@/lib/confirmDialog";
import type { ConfirmOptions } from "@/models/ConfirmOptions";

// A submit button that asks first: the click is held, and the form is submitted with that button once confirmed (its
// own action and data-action still decide what runs).
export function confirmedClick(event: MouseEvent<HTMLButtonElement>, options: ConfirmOptions): void {
  const button = event.currentTarget;
  const form = button.form;

  event.preventDefault();

  if (form) {
    void confirmDialog(options).then((accepted) => accepted && form.requestSubmit(button));
  }
}

// A form that asks before it submits: the submit is held and sent again, once, when confirmed.
export function confirmedSubmit(event: FormEvent<HTMLFormElement>, options: ConfirmOptions): void {
  const form = event.currentTarget;

  if (form.dataset.confirmed === "yes") {
    delete form.dataset.confirmed;

    return;
  }

  event.preventDefault();
  void confirmDialog(options).then((accepted) => accepted && sendConfirmed(form));
}

function sendConfirmed(form: HTMLFormElement): void {
  form.dataset.confirmed = "yes";
  form.requestSubmit();
}

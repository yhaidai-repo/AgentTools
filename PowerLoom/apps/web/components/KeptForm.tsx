"use client";

import { startTransition, useEffect, useRef, type FormHTMLAttributes, type RefObject, type SubmitEvent } from "react";

type FormAction = (data: FormData) => void;

interface KeptFormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, "action"> {
  /** useActionState's dispatch, or any function of the form's data: what a submit runs. */
  action: FormAction;
  /** Other buttons' actions, by the button's data-action (instead of a formAction, which React resets after too). */
  actions?: Record<string, FormAction>;
  /** An add form's result: once it is ok the fields clear, ready for the next one. Leave it out to always keep them. */
  clearOn?: { ok: boolean } | null;
  ref?: RefObject<HTMLFormElement | null>;
}

// A form that keeps what was typed (user request 2026-10-25): React resets a form after its own action, to the defaults
// rendered then, so a refused save or a redirect wiped every field. Here the submit starts the action itself, which React
// doesn't reset after; useActionState's pending state still works, since the action runs in a transition. The form's
// own onSubmit runs first and may still cancel the submit (inline checks, confirms). `action` stays on the form, so a
// submit before hydration behaves as before.
export function KeptForm({ action, actions = {}, clearOn, onSubmit, ref, ...props }: KeptFormProps) {
  const own = useRef<HTMLFormElement>(null);
  const form = ref ?? own;

  useEffect(() => {
    if (clearOn?.ok) {
      form.current?.reset();
    }
  }, [clearOn, form]);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    onSubmit?.(event);

    if (event.defaultPrevented) {
      return;
    }

    event.preventDefault();
    const submitter = event.submitter;
    const chosen = actions[submitter?.dataset.action ?? ""] ?? action;
    const data = new FormData(event.currentTarget, submitter);

    startTransition(() => chosen(data));
  }

  return <form ref={form} action={action} onSubmit={submit} {...props} />;
}

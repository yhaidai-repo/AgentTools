"use client";

import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";

interface DropdownProps {
  /** What the button shows (the current choice). */
  trigger: ReactNode;
  /** The button's accessible name, when the trigger alone doesn't say what it picks. */
  label: string;
  align?: "left" | "right";
  /** A framed pill button (a filter on a page) rather than the bare one of the top menu. */
  pill?: boolean;
  children: ReactNode;
}

// One dropdown look for every picker (user, 2026-10-18: no unstyled system lists): an opaque menu under its button;
// a click inside picks and closes it, a click outside or Escape closes it.
export function Dropdown({ trigger, label, align = "left", pill = false, children }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useCloseOnOutside(open, root, close);

  return (
    <div className="dropdown" ref={root}>
      <button type="button" className={`dropdown-trigger${pill ? " pill" : ""}`} aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}>
        {trigger}
        <Chevron />
      </button>
      {open && (
        <div className={`dropdown-menu align-${align}`} role="menu" onClick={close}>
          {children}
        </div>
      )}
    </div>
  );
}

function useCloseOnOutside(open: boolean, root: RefObject<HTMLDivElement | null>, close: () => void): void {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointer = (event: MouseEvent) => closeWhenOutside(root.current, event.target, close);
    const onKey = (event: KeyboardEvent) => closeOnEscape(event, close);

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, root, close]);
}

function closeWhenOutside(root: HTMLDivElement | null, target: EventTarget | null, close: () => void): void {
  if (root && !root.contains(target as Node)) {
    close();
  }
}

function closeOnEscape(event: KeyboardEvent, close: () => void): void {
  if (event.key === "Escape") {
    close();
  }
}

function Chevron() {
  return (
    <svg className="dropdown-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

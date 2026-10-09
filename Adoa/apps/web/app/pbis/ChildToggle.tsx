"use client";

import { useState, type MouseEvent } from "react";

// Folds a PBI's child items: the rows stay in the page (their checkboxes too), only hidden by the group's attribute.
export function ChildToggle({ count }: { count: number }) {
  const [isFolded, setFolded] = useState(false);

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    const group = event.currentTarget.closest("tbody");

    group?.toggleAttribute("data-folded", !isFolded);
    setFolded(!isFolded);
  }

  return (
    <button type="button" className="link-button" onClick={onClick} aria-expanded={!isFolded}>
      {isFolded ? "▸" : "▾"} {count} child item{count === 1 ? "" : "s"}
    </button>
  );
}

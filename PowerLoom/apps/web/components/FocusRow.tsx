"use client";

import { useEffect } from "react";

// Coming back from a detail page (user request 2026-10-18): the row scrolls to the middle of the screen and glows once;
// the server already put it on the right page (and unfolded its group). The focus then leaves the URL, so a refresh or
// the remembered filters don't scroll again.
export function FocusRow({ rowId }: { rowId: string }) {
  useEffect(() => {
    const row = document.getElementById(rowId);

    row?.scrollIntoView({ block: "center" });
    row?.classList.add("focused");
    window.history.replaceState(null, "", withoutFocus(window.location.href));
  }, [rowId]);

  return null;
}

function withoutFocus(href: string): string {
  const url = new URL(href);

  url.searchParams.delete("focus");

  return `${url.pathname}?${url.searchParams.toString()}`;
}

"use client";

import { useEffect } from "react";

// Coming back from a PBI (user request 2026-10-18): the row scrolls to the middle of the screen and glows once; the
// group was already put on the right page and unfolded by the server. The focus then leaves the URL, so a refresh or
// the remembered filters don't scroll again.
export function FocusRow({ adoId }: { adoId: number }) {
  useEffect(() => {
    const row = document.getElementById(`pbi-${adoId}`);

    row?.scrollIntoView({ block: "center" });
    row?.classList.add("focused");
    window.history.replaceState(null, "", withoutFocus(window.location.href));
  }, [adoId]);

  return null;
}

function withoutFocus(href: string): string {
  const url = new URL(href);

  url.searchParams.delete("focus");

  return `${url.pathname}?${url.searchParams.toString()}`;
}

"use client";

import { useTransition } from "react";
import { removeConfluenceLink } from "./actions";

export function RemoveLinkButton({ adoId, url }: { adoId: number; url: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button type="button" className="secondary" disabled={isPending} onClick={() => startTransition(() => removeConfluenceLink(adoId, url))}>
      {isPending ? "Removing…" : "Remove"}
    </button>
  );
}

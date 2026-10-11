"use client";

import { useState, useTransition } from "react";
import { loadFromConfluence } from "./actions";

// For a linked Confluence page agents can't read yet: the worker fetches it now.
export function LoadFromConfluenceButton({ adoId, url }: { adoId: number; url: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onLoad() {
    startTransition(async () => {
      setMessage((await loadFromConfluence(adoId, url)).message);
    });
  }

  return (
    <span className="actions">
      <button type="button" className="secondary" onClick={onLoad} disabled={isPending}>{isPending ? "Asking…" : "Load from Confluence"}</button>
      {message && <span className="muted">{message}</span>}
    </span>
  );
}

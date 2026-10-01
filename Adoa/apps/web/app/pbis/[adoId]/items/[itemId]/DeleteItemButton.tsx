"use client";

import { useState, useTransition } from "react";
import { deleteItemAction } from "../../actions";

// Asks first: a deleted item disappears from the pages and the Vault, and agents won't create it again.
export function DeleteItemButton({ adoId, itemId }: { adoId: number; itemId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm(`Delete ${itemId}? It disappears from adoa and the Vault, and agents won't create it again.`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteItemAction(adoId, itemId);

      setMessage(result.ok ? null : result.message);
    });
  }

  return (
    <span className="actions">
      <button type="button" className="secondary" onClick={onDelete} disabled={isPending}>{isPending ? "Deleting…" : "Delete"}</button>
      {message && <span className="result-error">{message}</span>}
    </span>
  );
}

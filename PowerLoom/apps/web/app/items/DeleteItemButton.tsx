"use client";

import { useState, useTransition } from "react";
import { confirmDialog, noticeDialog } from "@/lib/confirmDialog";
import { deleteItemAction } from "./actions";

// Asks first: a deleted item disappears from the pages and the Vault, and agents won't create it again. In the header's
// ⋯ menu it is a rose menu entry, and a refusal shows as an alert (the menu closes on the click).
export function DeleteItemButton({ adoId, itemId, inMenu = false }: { adoId: number | null; itemId: string; inMenu?: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onDelete() {
    const isConfirmed = await confirmDialog({ title: `Delete ${itemId}?`, message: "It disappears from PowerLoom and the Vault, and agents won't create it again.", confirmLabel: "Delete", isDanger: true });

    if (!isConfirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteItemAction(adoId, itemId);

      setMessage(result.ok ? null : result.message);

      if (inMenu && !result.ok) {
        void noticeDialog(result.message);
      }
    });
  }

  if (inMenu) {
    return <button type="button" className="menu-item danger-item" role="menuitem" onClick={onDelete} disabled={isPending}>Delete…</button>;
  }

  return (
    <span className="actions">
      <button type="button" className="secondary" onClick={onDelete} disabled={isPending}>{isPending ? "Deleting…" : "Delete"}</button>
      {message && <span className="result-error">{message}</span>}
    </span>
  );
}

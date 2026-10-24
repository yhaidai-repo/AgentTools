"use client";

import { useState, useTransition } from "react";
import { deletePbiAction } from "../actions";

// Asks first: the PBI and everything PowerLoom made for it go, and sync won't bring it back (ADO stays untouched).
// In the header's ⋯ menu it is a rose menu entry, and a refusal shows as an alert (the menu closes on the click).
export function DeletePbiButton({ adoId, inMenu = false }: { adoId: number; inMenu?: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    const question = `Delete PBI-${adoId} from PowerLoom? Its child items, tasks, questions, runs, attachments, repos and notes are removed, and sync won't import it again (Sync PBI brings it back). Azure DevOps is not changed.`;

    if (!window.confirm(question)) {
      return;
    }

    startTransition(async () => {
      const result = await deletePbiAction(adoId);

      setMessage(result.ok ? null : result.message);

      if (inMenu && !result.ok) {
        window.alert(result.message);
      }
    });
  }

  if (inMenu) {
    return <button type="button" className="menu-item danger-item" role="menuitem" onClick={onDelete} disabled={isPending}>Delete from PowerLoom…</button>;
  }

  return (
    <span className="actions">
      <button type="button" className="secondary" onClick={onDelete} disabled={isPending}>{isPending ? "Deleting…" : "Delete from PowerLoom"}</button>
      {message && <span className="result-error">{message}</span>}
    </span>
  );
}

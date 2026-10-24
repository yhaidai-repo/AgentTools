"use client";

import { useState, useTransition } from "react";
import { closePbiAction, reopenPbiAction } from "../actions";

// Close keeps the PBI for the agents to read (unlike Delete); Reopen brings back one the user closed. A PBI closed in
// ADO shows neither: it follows ADO. In the header's ⋯ menu it is a menu entry, and a refusal shows as an alert (the
// menu closes on the click).
export function ClosePbiButton({ adoId, closedByUser, isClosed, inMenu = false }: { adoId: number; closedByUser: boolean; isClosed: boolean; inMenu?: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (isClosed && !closedByUser) {
    return null;
  }

  function onClose() {
    if (!window.confirm(`Close PBI-${adoId} in PowerLoom? Its open tasks and questions are cancelled and its open child items close with it. It stays for the agents to read; Azure DevOps is not changed.`)) {
      return;
    }

    startTransition(async () => report(messageOf(await closePbiAction(adoId))));
  }

  function onReopen() {
    startTransition(async () => report(messageOf(await reopenPbiAction(adoId))));
  }

  function report(problem: string | null) {
    if (inMenu && problem) {
      window.alert(problem);
    }

    setMessage(problem);
  }

  if (inMenu) {
    return closedByUser ? <button type="button" className="menu-item" role="menuitem" onClick={onReopen} disabled={isPending}>Reopen</button> : <button type="button" className="menu-item" role="menuitem" onClick={onClose} disabled={isPending}>Close…</button>;
  }

  return (
    <span className="actions">
      {closedByUser ? <button type="button" className="secondary" onClick={onReopen} disabled={isPending}>{isPending ? "Reopening…" : "Reopen"}</button> : <button type="button" className="secondary" onClick={onClose} disabled={isPending}>{isPending ? "Closing…" : "Close"}</button>}
      {message && <span className="result-error">{message}</span>}
    </span>
  );
}

function messageOf(result: { ok: boolean; message: string }): string | null {
  return result.ok ? null : result.message;
}

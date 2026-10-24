"use client";

import { useTransition } from "react";
import { cancelTaskAction } from "./actions";

// Asks first: a cancelled agent task is over, no agent takes it again (Re-run opens a blocked one instead). An entry of
// the header's ⋯ menu, so a refusal shows as an alert (the menu closes on the click).
export function CancelTaskButton({ adoId, itemId }: { adoId: number | null; itemId: string }) {
  const [isPending, startTransition] = useTransition();

  function onCancel() {
    if (!window.confirm(`Cancel ${itemId}? No agent will take it again.`)) {
      return;
    }

    startTransition(async () => {
      const result = await cancelTaskAction(adoId, itemId);

      if (!result.ok) {
        window.alert(result.message);
      }
    });
  }

  return <button type="button" className="menu-item" role="menuitem" onClick={onCancel} disabled={isPending}>Cancel task…</button>;
}

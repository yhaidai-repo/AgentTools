"use client";

import { useState, useTransition } from "react";
import { deleteAgentAction } from "../../configActions";

// Only for agents created in the UI; the ones shipped in code come back on the next start anyway. Its runs and the tasks
// pinned to it stay; open tasks of the types it handled go to the other agents that handle them.
export function DeleteAgentButton({ agentId, label }: { agentId: string; label: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm(`Delete the agent ${label}? Its runs stay; it won't take tasks any more.`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteAgentAction(agentId);

      setMessage(result.ok ? null : result.message);
    });
  }

  return (
    <span className="actions">
      <button type="button" className="secondary" onClick={onDelete} disabled={isPending}>{isPending ? "Deleting…" : "Delete agent"}</button>
      {message && <span className="result-error">{message}</span>}
    </span>
  );
}

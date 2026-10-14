"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { saveAzureSubscriptionAction } from "./actions";

// The subscription the Azure MCP server uses when an agent names none; empty = agents name one (subscription_list).
export function AzureSubscriptionForm({ subscription }: { subscription: string }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveAzureSubscriptionAction, null);

  return (
    <form action={action}>
      <label>
        Default subscription (id or name; empty = agents name one per call)
        <input name="subscription" defaultValue={subscription} placeholder="AA Dev" maxLength={120} />
      </label>
      <div className="actions">
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}

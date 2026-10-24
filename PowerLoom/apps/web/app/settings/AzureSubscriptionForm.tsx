"use client";

import { useActionState } from "react";
import { ResultLine } from "@/components/ResultLine";
import type { ActionResult } from "@/models/ActionResult";
import { saveAzureSubscriptionAction } from "./actions";

// The subscription the Azure MCP server uses when an agent names none; empty = agents name one (subscription_list).
export function AzureSubscriptionForm({ subscription }: { subscription: string }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveAzureSubscriptionAction, null);

  return (
    <form action={action} className="inline-form">
      <label className="field"><span>Default subscription<small>id or name; empty = agents name one per call</small></span><input name="subscription" defaultValue={subscription} placeholder="AA Dev" maxLength={120} /></label>
      <div className="actions">
        <button type="submit" className="secondary small" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
        <ResultLine result={result} />
      </div>
    </form>
  );
}

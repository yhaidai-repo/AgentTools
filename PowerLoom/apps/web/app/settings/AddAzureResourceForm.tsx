"use client";

import { useActionState } from "react";
import type { AzureResourceKind } from "@powerloom/core";
import type { ActionResult } from "@/models/ActionResult";
import { addAzureResourceAction } from "./actions";

// Cosmos DB and Mongo accounts by name (user decision 2026-10-14): the keys come with the sign-in at call time.
const ACCOUNT_LABELS: Partial<Record<AzureResourceKind, string>> = {
  cosmos: "Cosmos DB account name (portal → the account → Overview)",
  mongo: "Cosmos DB for MongoDB account name (portal → the account → Overview)",
};

export function AddAzureResourceForm({ kind }: { kind: AzureResourceKind }) {
  const [result, action, isAdding] = useActionState<ActionResult | null, FormData>(addAzureResourceAction, null);

  return (
    <form action={action}>
      <input type="hidden" name="kind" value={kind} />
      <label>
        Resource name (agents pick the account by it: letters, digits, _ and -)
        <input name="name" placeholder={`pvs-stage-${kind}`} maxLength={40} required />
      </label>
      <label>
        {ACCOUNT_LABELS[kind]}
        <input name="target" placeholder="aa-stage-signals-cosmos" maxLength={44} required />
      </label>
      <div className="actions">
        <button type="submit" disabled={isAdding}>{isAdding ? "Adding…" : "Add account"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}

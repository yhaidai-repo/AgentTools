"use client";

import { useActionState } from "react";
import type { AzureResourceKind } from "@powerloom/core";
import type { ActionResult } from "@/models/ActionResult";
import { addAzureResourceAction } from "./actions";

// Cosmos DB and Mongo accounts by name (the keys come with the sign-in at call time); Service Bus namespaces by a
// Listen-only connection string, written once and never shown again (user decisions 2026-10-14).
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
        Resource name (agents see it next to the account or namespace: letters, digits, _ and -)
        <input name="name" placeholder={`pvs-stage-${kind}`} maxLength={40} required />
      </label>
      {kind === "serviceBus" ? <ConnectionStringField /> : <AccountField kind={kind} />}
      <div className="actions">
        <button type="submit" disabled={isAdding}>{isAdding ? "Adding…" : "Add"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}

function AccountField({ kind }: { kind: AzureResourceKind }) {
  return (
    <label>
      {ACCOUNT_LABELS[kind]}
      <input name="target" placeholder="aa-stage-signals-cosmos" maxLength={44} required />
    </label>
  );
}

function ConnectionStringField() {
  return (
    <label>
      Connection string of a shared access policy with Listen only (portal → the namespace → Shared access policies)
      <input name="secret" type="password" autoComplete="off" placeholder="Endpoint=sb://aa-dev-sb01.servicebus.windows.net/;SharedAccessKeyName=listen;SharedAccessKey=…" required />
    </label>
  );
}

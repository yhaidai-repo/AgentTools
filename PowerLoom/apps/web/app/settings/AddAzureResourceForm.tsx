"use client";

import { useActionState } from "react";
import type { AzureResourceKind } from "@powerloom/core";
import type { ActionResult } from "@/models/ActionResult";
import { addAzureResourceAction } from "./actions";

// Cosmos DB and Mongo accounts by name (the keys come with the sign-in at call time); Service Bus namespaces and Mongo
// servers outside Cosmos by a connection string, written once and never shown again (user decisions 2026-10-14/15).
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
      {kind === "serviceBus" ? <ConnectionStringField /> : kind === "mongo" ? <MongoFields /> : <AccountField kind={kind} required />}
      <div className="actions">
        <button type="submit" disabled={isAdding}>{isAdding ? "Adding…" : "Add"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}

function AccountField({ kind, required }: { kind: AzureResourceKind; required: boolean }) {
  return (
    <label>
      {ACCOUNT_LABELS[kind]}
      <input name="target" placeholder="aa-stage-signals-cosmos" maxLength={44} required={required} />
    </label>
  );
}

// One of the two: a Cosmos DB for MongoDB account, or any other Mongo server by its connection string.
function MongoFields() {
  return (
    <>
      <AccountField kind="mongo" required={false} />
      <label>
        or the connection string of another Mongo server, best a read-only user (mongodb:// or mongodb+srv://)
        <input name="secret" type="password" autoComplete="off" placeholder="mongodb://reader:…@10.35.15.93:27017/?authMechanism=SCRAM-SHA-256" />
      </label>
    </>
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

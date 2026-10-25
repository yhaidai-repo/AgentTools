"use client";

import { useActionState } from "react";
import type { AzureResourceKind } from "@powerloom/core";
import { ResultLine } from "@/components/ResultLine";
import type { ActionResult } from "@/models/ActionResult";
import { addAzureResourceAction } from "./actions";
import { KeptForm } from "@/components/KeptForm";

// Cosmos DB and Mongo accounts by name (the keys come with the sign-in at call time); Service Bus namespaces and Mongo
// servers outside Cosmos by a connection string, written once and never shown again (user decisions 2026-10-14/15).
const ACCOUNT_LABELS: Partial<Record<AzureResourceKind, string>> = {
  cosmos: "Cosmos DB account name",
  mongo: "Cosmos DB for MongoDB account name",
};

const ADD_LABELS: Partial<Record<AzureResourceKind, string>> = {
  cosmos: "+ Add an account",
  mongo: "+ Add a server",
  serviceBus: "+ Add a namespace",
};

// Folded until wanted (user decision 2026-10-18).
export function AddAzureResourceForm({ kind }: { kind: AzureResourceKind }) {
  const [result, action, isAdding] = useActionState<ActionResult | null, FormData>(addAzureResourceAction, null);

  return (
    <details className="add-form">
      <summary>{ADD_LABELS[kind] ?? "+ Add"}</summary>
      <KeptForm action={action} clearOn={result}>
        <input type="hidden" name="kind" value={kind} />
        <div className="field-grid">
          <label className="field"><span>Name<small>agents see it next to the account or namespace: letters, digits, _ and -</small></span><input name="name" placeholder={`app-stage-${kind}`} maxLength={40} required /></label>
          {kind === "serviceBus" ? <ConnectionStringField /> : <AccountField kind={kind} required={kind !== "mongo"} />}
          {kind === "mongo" && <MongoServerField />}
        </div>
        <div className="actions">
          <button type="submit" disabled={isAdding}>{isAdding ? "Adding…" : "Add"}</button>
          <ResultLine result={result} />
        </div>
      </KeptForm>
    </details>
  );
}

function AccountField({ kind, required }: { kind: AzureResourceKind; required: boolean }) {
  return <label className="field"><span>{ACCOUNT_LABELS[kind]}<small>portal → the account → Overview</small></span><input name="target" placeholder="app-stage-cosmos" maxLength={44} required={required} /></label>;
}

// Or any other Mongo server by its connection string, best a read-only user.
function MongoServerField() {
  return <label className="field"><span>or a Mongo server&apos;s connection string<small>mongodb:// or mongodb+srv://, best a read-only user</small></span><input name="secret" type="password" autoComplete="off" placeholder="mongodb://reader:…@mongo.example.internal:27017/?authMechanism=SCRAM-SHA-256" /></label>;
}

function ConnectionStringField() {
  return <label className="field"><span>Connection string<small>a shared access policy with Listen only (portal → the namespace → Shared access policies)</small></span><input name="secret" type="password" autoComplete="off" placeholder="Endpoint=sb://app-dev-bus.servicebus.windows.net/;SharedAccessKeyName=listen;SharedAccessKey=…" required /></label>;
}

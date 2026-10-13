"use client";

import { useActionState } from "react";
import type { AzureResourceKind } from "@powerloom/core";
import type { ActionResult } from "@/models/ActionResult";
import { addAzureResourceAction } from "./actions";

interface KindFields {
  target: { label: string; placeholder: string } | null;
  secret: { label: string; placeholder: string } | null;
}

// What each kind asks for (user decision 2026-10-13: keys per resource). A secret is written once, never shown again.
const KINDS: Record<AzureResourceKind, KindFields> = {
  appInsights: {
    target: { label: "Resource id of the component or workspace (portal → the resource → JSON View → id)", placeholder: "/subscriptions/…/resourceGroups/…/providers/microsoft.insights/components/pvs-api" },
    secret: null,
  },
  cosmos: {
    target: { label: "Account endpoint", placeholder: "https://pvs-stage.documents.azure.com" },
    secret: { label: "Read-only key (portal → the account → Keys → Read-only Keys)", placeholder: "…==" },
  },
  serviceBus: {
    target: null,
    secret: { label: "Connection string of a shared access policy with Listen only (portal → the namespace or queue → Shared access policies)", placeholder: "Endpoint=sb://pvs-stage.servicebus.windows.net/;SharedAccessKeyName=listen;SharedAccessKey=…" },
  },
  mongo: {
    target: null,
    secret: { label: "Read-only connection string (portal → the account → Connection strings → read-only)", placeholder: "mongodb://pvs-stage:…@pvs-stage.mongo.cosmos.azure.com:10255/?ssl=true" },
  },
};

export function AddAzureResourceForm({ kind }: { kind: AzureResourceKind }) {
  const [result, action, isAdding] = useActionState<ActionResult | null, FormData>(addAzureResourceAction, null);
  const fields = KINDS[kind];

  return (
    <form action={action}>
      <input type="hidden" name="kind" value={kind} />
      <label>
        Resource name (agents pick the resource by it: letters, digits, _ and -)
        <input name="name" placeholder={`pvs-stage-${kind.toLowerCase()}`} maxLength={40} required />
      </label>
      {fields.target && (
        <label>
          {fields.target.label}
          <input name="target" placeholder={fields.target.placeholder} required />
        </label>
      )}
      {fields.secret && (
        <label>
          {fields.secret.label}
          <input name="secret" type="password" autoComplete="off" placeholder={fields.secret.placeholder} required />
        </label>
      )}
      <div className="actions">
        <button type="submit" disabled={isAdding}>{isAdding ? "Adding…" : "Add resource"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}

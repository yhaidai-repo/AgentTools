"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { addAzureResourceAction } from "./actions";

// A Mongo target is a connection string, written once and never shown again; the other targets are plain ids.
export function AddAzureResourceForm() {
  const [result, action, isAdding] = useActionState<ActionResult | null, FormData>(addAzureResourceAction, null);

  return (
    <form action={action}>
      <label>
        Resource name (agents pick the resource by it: letters, digits, _ and -)
        <input name="name" placeholder="pvs-stage-logs" maxLength={40} required />
      </label>
      <label>
        Kind
        <select name="kind" defaultValue="appInsights">
          <option value="appInsights">App Insights / Log Analytics</option>
          <option value="cosmos">Cosmos DB (NoSQL)</option>
          <option value="serviceBus">Service Bus</option>
          <option value="mongo">Mongo (Cosmos DB for MongoDB)</option>
        </select>
      </label>
      <label>
        <span>Target: the resource id of an App Insights component or a Service Bus namespace (portal → JSON View → <code>id</code>), a Cosmos account endpoint (<code>https://&lt;account&gt;.documents.azure.com</code>), or a Mongo connection string with the read-only key</span>
        <input name="target" type="password" autoComplete="off" placeholder="/subscriptions/…/providers/microsoft.insights/components/pvs-api" required />
      </label>
      <div className="actions">
        <button type="submit" disabled={isAdding}>{isAdding ? "Adding…" : "Add resource"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}

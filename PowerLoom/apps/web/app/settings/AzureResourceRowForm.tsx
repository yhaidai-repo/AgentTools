"use client";

import { useTransition } from "react";
import type { AzureResourceRow } from "@/models/AzureResourceRow";
import { removeAzureResourceAction, setAzureResourceEnabledAction } from "./actions";

const KIND_LABELS: Record<AzureResourceRow["kind"], string> = { appInsights: "App Insights", cosmos: "Cosmos DB", serviceBus: "Service Bus", mongo: "Mongo" };

// One resource: its switch saves at once; to change its target, remove it and add it again.
export function AzureResourceRowForm({ resource }: { resource: AzureResourceRow }) {
  const [isPending, startTransition] = useTransition();

  return (
    <tr className={resource.enabled ? undefined : "muted"}>
      <td>
        <input type="checkbox" checked={resource.enabled} disabled={isPending} onChange={(event) => startTransition(() => setAzureResourceEnabledAction(resource.name, event.target.checked))} />
      </td>
      <td>{resource.name}</td>
      <td>{KIND_LABELS[resource.kind]}</td>
      <td><code>{resource.display}</code></td>
      <td>
        <button type="button" disabled={isPending} onClick={() => startTransition(() => removeAzureResourceAction(resource.name))}>Remove</button>
      </td>
    </tr>
  );
}

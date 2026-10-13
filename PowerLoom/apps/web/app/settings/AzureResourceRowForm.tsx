"use client";

import { useTransition } from "react";
import type { AzureResourceRow } from "@/models/AzureResourceRow";
import { removeAzureResourceAction, setAzureResourceEnabledAction } from "./actions";

// One resource: its switch saves at once; to change its target or secret, remove it and add it again.
export function AzureResourceRowForm({ resource }: { resource: AzureResourceRow }) {
  const [isPending, startTransition] = useTransition();

  return (
    <tr className={resource.enabled ? undefined : "muted"}>
      <td>
        <input type="checkbox" checked={resource.enabled} disabled={isPending} onChange={(event) => startTransition(() => setAzureResourceEnabledAction(resource.name, event.target.checked))} />
      </td>
      <td>{resource.name}</td>
      <td><code>{resource.display}</code></td>
      <td>
        <button type="button" disabled={isPending} onClick={() => startTransition(() => removeAzureResourceAction(resource.name))}>Remove</button>
      </td>
    </tr>
  );
}

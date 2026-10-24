"use client";

import { useTransition } from "react";
import type { AzureResourceRow } from "@/models/AzureResourceRow";
import { removeAzureResourceAction, setAzureResourceEnabledAction } from "./actions";

// One resource: its switch saves at once; to change its target or secret, remove it and add it again.
export function AzureResourceRowForm({ resource }: { resource: AzureResourceRow }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className={`resource-row${resource.enabled ? "" : " off"}`}>
      <label className="row-switch">
        <input type="checkbox" checked={resource.enabled} disabled={isPending} onChange={(event) => startTransition(() => setAzureResourceEnabledAction(resource.name, event.target.checked))} aria-label={`${resource.name} enabled`} />
        <span className="switch-knob" aria-hidden="true" />
      </label>
      <span className="resource-name-text">{resource.name}</span>
      <span className="resource-target">{resource.display}</span>
      <span />
      <span className="resource-actions"><button type="button" className="danger small" disabled={isPending} onClick={() => startTransition(() => removeAzureResourceAction(resource.name))}>Remove</button></span>
    </div>
  );
}

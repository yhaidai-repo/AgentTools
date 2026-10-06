"use client";

import { useActionState } from "react";
import { removeVaultAction } from "@/app/vaults/actions";
import type { ActionResult } from "@/models/ActionResult";

export function RemoveVaultForm({ vault }: { vault: string }) {
  const [result, action, isRemoving] = useActionState<ActionResult | null, FormData>(removeVaultAction, null);

  return (
    <form action={action}>
      <input type="hidden" name="vault" value={vault} />
      <button type="submit" disabled={isRemoving}>Remove</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}> {result.message}</span>}
    </form>
  );
}

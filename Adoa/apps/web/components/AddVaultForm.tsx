"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { addVaultAction } from "@/app/vaults/actions";
import { closeVaultsDialog } from "@/lib/vaultsDialog";
import type { AddVaultResult } from "@/models/AddVaultResult";
import { selectVault } from "./VaultSelect";

// A vault just added becomes the selected one, and the dialog closes.
export function AddVaultForm({ vaultsRoot }: { vaultsRoot: string }) {
  const router = useRouter();
  const [result, action, isAdding] = useActionState<AddVaultResult | null, FormData>(addVaultAction, null);

  useEffect(() => {
    if (!result?.vault) {
      return;
    }

    selectVault(result.vault);
    closeVaultsDialog();
    router.refresh();
  }, [result, router]);

  return (
    <form action={action}>
      <label>
        Add a vault: a folder inside <code>{vaultsRoot}</code> (its name or its path; created when missing)
        <input name="folder" placeholder={`${vaultsRoot}/my-vault`} required />
      </label>
      <div className="actions">
        <button type="submit" disabled={isAdding}>{isAdding ? "Adding…" : "Add vault"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}

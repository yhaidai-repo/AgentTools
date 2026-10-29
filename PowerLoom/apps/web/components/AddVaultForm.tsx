"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { addVaultAction } from "@/app/vaults/actions";
import { closeVaultsDialog } from "@/lib/vaultsDialog";
import type { AddVaultResult } from "@/models/AddVaultResult";
import { selectVault } from "./VaultSelect";
import { KeptForm } from "@/components/KeptForm";

// A vault just added becomes the selected one, and the dialog closes.
export function AddVaultForm({ vaultsRoot, freeFolders }: { vaultsRoot: string; freeFolders: string[] }) {
  const router = useRouter();
  const folderInput = useRef<HTMLInputElement>(null);
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
    <KeptForm action={action} clearOn={result}>
      <label>
        Add a vault: a folder inside <code>{vaultsRoot}</code>
        <input ref={folderInput} name="folder" placeholder={`${vaultsRoot}/my-vault`} required />
      </label>
      {freeFolders.length > 0 && (
        <div className="folder-choices" aria-label="Folders that aren't vaults yet">
          {freeFolders.map((folder) => <button key={folder} type="button" className="repo-chip" onClick={() => { if (folderInput.current) { folderInput.current.value = folder; folderInput.current.focus(); } }}>{folder}</button>)}
        </div>
      )}
      <div className="actions">
        <button type="submit" disabled={isAdding}>{isAdding ? "Adding…" : "Add vault"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </KeptForm>
  );
}

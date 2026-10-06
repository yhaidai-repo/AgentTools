"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { COOKIE_MAX_AGE_SECONDS, VAULT_COOKIE } from "@/lib/sharedFilters";
import { VAULTS_DIALOG_ID, openVaultsDialog } from "@/lib/vaultsDialog";

const ADD_VAULT = "__add__";

// The global vault choice (user decision 2026-10-05): every page shows the selected vault's PBIs, tasks and notes. Its
// last entry opens the Vaults dialog (user decision 2026-10-06), rendered here once for every page.
export function VaultSelect({ vaults, current, dialog }: { vaults: string[]; current: string | null; dialog: ReactNode }) {
  const router = useRouter();

  function onChoice(value: string): void {
    if (value === ADD_VAULT) {
      openVaultsDialog();

      return;
    }

    selectVault(value);
    router.refresh();
  }

  return (
    <label className="vault-select">
      Vault
      <select value={current ?? ADD_VAULT} onChange={(event) => onChoice(event.currentTarget.value)}>
        {vaults.map((vault) => <option key={vault} value={vault}>{vault}</option>)}
        <option value={ADD_VAULT}>{vaults.length === 0 ? "none: add a vault…" : "Add vault…"}</option>
      </select>
      <dialog id={VAULTS_DIALOG_ID} className="modal vaults-dialog">{dialog}</dialog>
    </label>
  );
}

export function selectVault(vault: string): void {
  document.cookie = `${VAULT_COOKIE}=${encodeURIComponent(vault)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

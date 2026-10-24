"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { COOKIE_MAX_AGE_SECONDS, VAULT_COOKIE } from "@/lib/sharedFilters";
import { vaultInitials } from "@/lib/vaultInitials";
import { VAULTS_DIALOG_ID, openVaultsDialog } from "@/lib/vaultsDialog";
import { Dropdown } from "./Dropdown";

// The global vault choice (user decision 2026-10-05): every page shows the selected vault's data. It sits at the right
// end of the top menu as a switcher (user decision 2026-10-18); its last entry opens the Vaults dialog (user decision
// 2026-10-06), rendered here once for every page.
export function VaultSelect({ vaults, current, dialog }: { vaults: string[]; current: string | null; dialog: ReactNode }) {
  const router = useRouter();

  function choose(vault: string): void {
    selectVault(vault);
    router.refresh();
  }

  return (
    <>
      <Dropdown label="Vault" align="right" trigger={<VaultTrigger current={current} />}>
        <div className="menu-title">Vaults</div>
        {vaults.map((vault) => <VaultChoice key={vault} vault={vault} current={vault === current} onChoose={choose} />)}
        <div className="menu-sep" />
        <button type="button" className="menu-item plain" role="menuitem" onClick={openVaultsDialog}>{vaults.length === 0 ? "Add a vault…" : "Manage vaults…"}</button>
      </Dropdown>
      <dialog id={VAULTS_DIALOG_ID} className="modal vaults-dialog">{dialog}</dialog>
    </>
  );
}

function VaultTrigger({ current }: { current: string | null }) {
  if (!current) {
    return <span>Add vault</span>;
  }

  return (
    <>
      <VaultTile vault={current} />
      <span className="vault-name">{current}</span>
    </>
  );
}

function VaultChoice({ vault, current, onChoose }: { vault: string; current: boolean; onChoose: (vault: string) => void }) {
  return (
    <button type="button" className={`menu-item${current ? " current" : ""}`} role="menuitem" onClick={() => onChoose(vault)}>
      <VaultTile vault={vault} />
      <span className="menu-text">{vault}</span>
      {current && <span className="menu-check" aria-label="current">✓</span>}
    </button>
  );
}

function VaultTile({ vault }: { vault: string }) {
  return <span className="vault-tile" aria-hidden="true">{vaultInitials(vault)}</span>;
}

export function selectVault(vault: string): void {
  document.cookie = `${VAULT_COOKIE}=${encodeURIComponent(vault)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

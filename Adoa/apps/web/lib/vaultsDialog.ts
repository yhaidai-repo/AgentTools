// The Vaults dialog is rendered once, in the top bar; any page can open it by this id (e.g. the "no vault" placeholder).
export const VAULTS_DIALOG_ID = "vaults-dialog";

export function openVaultsDialog(): void {
  (document.getElementById(VAULTS_DIALOG_ID) as HTMLDialogElement | null)?.showModal();
}

export function closeVaultsDialog(): void {
  (document.getElementById(VAULTS_DIALOG_ID) as HTMLDialogElement | null)?.close();
}

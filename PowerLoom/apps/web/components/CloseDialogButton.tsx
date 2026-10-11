"use client";

import { closeVaultsDialog } from "@/lib/vaultsDialog";

export function CloseDialogButton() {
  return <button type="button" className="secondary" onClick={closeVaultsDialog}>Close</button>;
}

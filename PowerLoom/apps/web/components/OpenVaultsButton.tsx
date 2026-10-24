"use client";

import { openVaultsDialog } from "@/lib/vaultsDialog";

export function OpenVaultsButton() {
  return <button type="button" onClick={openVaultsDialog}>Add vault</button>;
}

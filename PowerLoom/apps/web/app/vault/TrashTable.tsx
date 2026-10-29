"use client";

import { useState, useTransition } from "react";
import { TimeAgo } from "@/components/TimeAgo";
import { confirmDialog } from "@/lib/confirmDialog";
import type { TrashRow } from "@/models/TrashRow";
import { trashAction } from "./actions";

// The vault's `.trash/` (user decision 2026-10-06): what the vault review removed, restorable or deletable for good.
export function TrashTable({ rows }: { rows: TrashRow[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function act(path: string, action: "restore" | "delete"): Promise<void> {
    if (action === "delete" && !(await confirmDialog({ title: "Delete for good?", message: path, confirmLabel: "Delete", isDanger: true }))) {
      return;
    }

    startTransition(async () => {
      const result = await trashAction(path, action);

      setMessage(result.message);
    });
  }

  return (
    <>
      <div className="panel">
        <table className="data-table vault-table">
          <thead>
            <tr><th>Note</th><th>Size</th><th>Removed</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.path}>
                <td>{row.path}</td>
                <td>{formatSize(row.sizeBytes)}</td>
                <td><TimeAgo date={row.modifiedAt} /></td>
                <td className="actions">
                  <button type="button" className="secondary" disabled={isPending} onClick={() => act(row.path, "restore")}>Restore</button>
                  <button type="button" className="danger" disabled={isPending} onClick={() => act(row.path, "delete")}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message && <p className="muted">{message}</p>}
    </>
  );
}

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

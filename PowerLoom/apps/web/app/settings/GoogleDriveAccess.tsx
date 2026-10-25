"use client";

import { useActionState, useTransition } from "react";
import { KeptForm } from "@/components/KeptForm";
import { ResultLine } from "@/components/ResultLine";
import type { ActionResult } from "@/models/ActionResult";
import type { GoogleDriveValues } from "@/models/GoogleDriveValues";
import { addDriveFolderAction, removeDriveFolderAction, signOutGoogleDriveAction } from "./googleDriveActions";

// Who is signed in (sign in goes through Google's own page), and the folders agents may read: each checked with that
// account when added, everything below it included.
export function GoogleDriveAccess({ values, message }: { values: GoogleDriveValues; message: string | null }) {
  const [result, addAction, isAdding] = useActionState<ActionResult | null, FormData>(addDriveFolderAction, null);
  const [isPending, startTransition] = useTransition();
  const hasClient = values.clientId.length > 0 && values.hasClientSecret;

  return (
    <div className="settings-body">
      {message && <p className="hint">{message}</p>}
      <div className="actions">
        {values.account ? <span>Signed in as <b>{values.account}</b></span> : <span className="muted">Nobody signed in.</span>}
        {hasClient && <a className="button secondary" href="/settings/google-drive/start">{values.account ? "Sign in again" : "Sign in with Google"}</a>}
        {values.account && <button type="button" className="link-button" disabled={isPending} onClick={() => startTransition(async () => void (await signOutGoogleDriveAction()))}>Sign out</button>}
      </div>
      {values.folders.length === 0 ? <p className="hint">No folders yet: agents read nothing until one is added.</p> : values.folders.map((folder) => (
        <div key={folder.id} className="resource-row">
          <span className="resource-name-text">{folder.name}</span>
          <span className="resource-target">{folder.id}</span>
          <span className="resource-actions"><button type="button" className="danger small" disabled={isPending} onClick={() => startTransition(async () => void (await removeDriveFolderAction(folder.id)))}>Remove</button></span>
        </div>
      ))}
      {values.account && (
        <KeptForm action={addAction} clearOn={result} className="actions">
          <input name="folder" required placeholder="Folder link, e.g. https://drive.google.com/drive/folders/…" aria-label="Drive folder" />
          <button type="submit" className="secondary" disabled={isAdding}>{isAdding ? "Checking…" : "Add folder"}</button>
          <ResultLine result={result} />
        </KeptForm>
      )}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { KeptForm } from "@/components/KeptForm";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import type { ActionResult } from "@/models/ActionResult";
import type { GoogleDriveValues } from "@/models/GoogleDriveValues";
import { saveGoogleDriveAction } from "./googleDriveActions";

// The switch and the user's own Google OAuth client (user decision 2026-10-25: sign in with Google). The secret is
// written, never shown again; an empty field keeps the saved one.
export function GoogleDriveForm({ values }: { values: GoogleDriveValues }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveGoogleDriveAction, null);

  return (
    <KeptForm action={action} clearOn={result}>
      <SettingsHead title="Google Drive" description="Agents with Google Drive switched on may search and read files in the folders below, and nothing else of the Drive. Read-only: the sign-in only allows reading." enabled={values.enabled} />
      <div className="settings-body">
        <details className="hint">
          <summary>Create the OAuth client (once)</summary>
          <ol>
            <li>Google Cloud console: a project, then APIs &amp; Services → enable the Google Drive API.</li>
            <li>OAuth consent screen: External, your account as a test user; then publish it (In production). In testing, Google ends the sign-in after 7 days.</li>
            <li>Credentials → Create credentials → OAuth client ID → Desktop app; copy its client ID and secret here.</li>
          </ol>
        </details>
        <div className="field-grid">
          <label className="field"><span>Client ID<small>…apps.googleusercontent.com</small></span><input name="clientId" defaultValue={values.clientId} autoComplete="off" /></label>
          <label className="field"><span>Client secret<small>{values.hasClientSecret ? "set; type a new one to replace it" : "GOCSPX-…"}</small></span><input name="clientSecret" type="password" autoComplete="off" placeholder={values.hasClientSecret ? "•••••••• unchanged" : ""} /></label>
        </div>
      </div>
      <div className="settings-foot">
        <ResultLine result={result} />
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </KeptForm>
  );
}

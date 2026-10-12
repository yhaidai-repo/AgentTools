"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import type { AzureIdentityValues } from "@/models/AzureIdentityValues";
import { saveAzureIdentityAction, testAzureIdentityAction } from "./actions";

// The secret is written, never shown again; an empty secret field keeps the saved one. Test signs in with the form's
// values through the agent-runner without saving.
export function AzureIdentityForm({ values }: { values: AzureIdentityValues }) {
  const [saveResult, saveAction, isSaving] = useActionState<ActionResult | null, FormData>(saveAzureIdentityAction, null);
  const [testResult, testAction, isTesting] = useActionState<ActionResult | null, FormData>(testAzureIdentityAction, null);
  const result = saveResult ?? testResult;

  return (
    <form>
      <label>
        Directory (tenant) id
        <input name="tenantId" defaultValue={values.tenantId} placeholder="00000000-0000-0000-0000-000000000000" required />
      </label>
      <label>
        Application (client) id
        <input name="clientId" defaultValue={values.clientId} placeholder="00000000-0000-0000-0000-000000000000" required />
      </label>
      <label>
        Client secret{values.hasSecret ? ": set; enter a new one to replace it" : ""}
        <input name="clientSecret" type="password" autoComplete="off" placeholder={values.hasSecret ? "unchanged" : ""} required={!values.hasSecret} />
      </label>
      <div className="actions">
        <button type="submit" formAction={saveAction} disabled={isSaving}>{isSaving ? "Saving…" : "Save identity"}</button>
        <button type="submit" formAction={testAction} disabled={isTesting} className="secondary">{isTesting ? "Testing…" : "Test sign-in"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}

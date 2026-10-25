"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { addConfluenceLink } from "./actions";
import { KeptForm } from "@/components/KeptForm";

// A useful Confluence page as an attachment that is a link instead of a file (user decision 2026-10-02).
export function ConfluenceLinkForm({ adoId }: { adoId: number }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(addConfluenceLink, null);

  return (
    <KeptForm action={action} clearOn={result} className="toolbar">
      <input type="hidden" name="adoId" value={adoId} />
      <input name="url" placeholder="or a Confluence page link" aria-label="Confluence page link" required />
      <input name="why" placeholder="Why it helps" aria-label="Why it helps" />
      <button type="submit" disabled={isPending}>{isPending ? "Adding…" : "Add link"}</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </KeptForm>
  );
}

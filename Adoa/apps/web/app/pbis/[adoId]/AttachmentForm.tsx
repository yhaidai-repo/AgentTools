"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { addAttachment } from "./actions";

// An upload not tied to a question; optionally the content of one of the PBI's linked documents.
export function AttachmentForm({ adoId, linkedUrls, accept }: { adoId: number; linkedUrls: string[]; accept: string }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(addAttachment, null);

  return (
    <form action={action} className="toolbar">
      <input type="hidden" name="adoId" value={adoId} />
      <input type="file" name="file" accept={accept} required />
      <select name="sourceUrl" defaultValue="">
        <option value="">Not a linked document</option>
        {linkedUrls.map((url) => <option key={url} value={url}>Content of {url}</option>)}
      </select>
      <button type="submit" disabled={isPending}>{isPending ? "Uploading…" : "Add attachment"}</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </form>
  );
}

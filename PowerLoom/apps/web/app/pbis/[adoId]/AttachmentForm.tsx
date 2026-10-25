"use client";

import { useActionState } from "react";
import { FileInput } from "@/components/FileInput";
import type { ActionResult } from "@/models/ActionResult";
import { addAttachment } from "./actions";
import { KeptForm } from "@/components/KeptForm";

// Any document useful for the PBI. The content of a linked document is uploaded on its "Attach the content" task's page,
// which closes the task (user decision 2026-10-02).
export function AttachmentForm({ adoId, accept }: { adoId: number; accept: string }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(addAttachment, null);

  return (
    <KeptForm action={action} clearOn={result} className="toolbar">
      <input type="hidden" name="adoId" value={adoId} />
      <FileInput name="file" accept={accept} required />
      <button type="submit" disabled={isPending}>{isPending ? "Uploading…" : "Add attachment"}</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </KeptForm>
  );
}

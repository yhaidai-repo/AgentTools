"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { answerComment } from "../actions";
import { KeptForm } from "@/components/KeptForm";

// Your answer to one comment; the agent reads it on the next run of this review (user decision 2026-10-02).
export function AnswerForm({ commentId, answer }: { commentId: string; answer: string | null }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(answerComment, null);

  return (
    <KeptForm action={action} className="answer-form">
      <input type="hidden" name="commentId" value={commentId} />
      <textarea name="answer" defaultValue={answer ?? ""} rows={2} placeholder="Your answer (e.g. why it's fine, or that you'll fix it)" aria-label={`Answer to ${commentId}`} />
      <div className="actions">
        <button type="submit" className="secondary" disabled={isPending}>{isPending ? "Saving…" : answer ? "Update answer" : "Answer"}</button>
        {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
      </div>
    </KeptForm>
  );
}

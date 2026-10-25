"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { checkPullRequestsNow } from "./actions";

// Lists your active PRs in Azure DevOps and on GitHub now instead of on the jobs' schedules.
export function CheckNowForm() {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(checkPullRequestsNow, null);

  return (
    <form action={action} className="actions">
      <button type="submit" className="secondary" disabled={isPending}>{isPending ? "Queuing…" : "Check now"}</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </form>
  );
}

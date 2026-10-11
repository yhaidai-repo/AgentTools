"use client";

import { useActionState } from "react";
import { SprintField } from "@/components/SprintField";
import type { ActionResult } from "@/models/ActionResult";
import type { SprintOption } from "@/models/SprintOption";
import { syncNow } from "./actions";

// The sprint to sync (saved as the sync setting) and the button that syncs it.
export function SyncForm({ sprint, options, current }: { sprint: string; options: SprintOption[] | null; current: string | null }) {
  const [result, action, isPending] = useActionState<ActionResult | null, FormData>(syncNow, null);

  return (
    <form action={action} className="actions">
      <SprintField value={sprint} options={options} current={current} />
      <button type="submit" disabled={isPending}>{isPending ? "Queuing…" : "Sync now"}</button>
      {result && <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>}
    </form>
  );
}

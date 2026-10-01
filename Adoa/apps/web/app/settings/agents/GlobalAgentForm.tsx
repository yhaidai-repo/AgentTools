"use client";

import { useActionState } from "react";
import type { AgentsGlobal } from "@agenttools/config";
import type { ActionResult } from "@/models/ActionResult";
import { saveGlobalAction } from "./actions";

export function GlobalAgentForm({ global }: { global: AgentsGlobal }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveGlobalAction, null);

  return (
    <form action={action} className="card">
      <label>
        Daily budget, all agents together ($, API-price estimate)
        <input name="dailyBudgetUsd" type="number" step="0.5" min={0} defaultValue={global.dailyBudgetUsd} required />
      </label>
      <div className="actions">
        <button type="submit" disabled={isSaving}>Save</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}

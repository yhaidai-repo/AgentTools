"use client";

import { useState, useTransition } from "react";
import { ResultLine } from "@/components/ResultLine";
import type { ActionResult } from "@/models/ActionResult";
import type { SqlConnectionRow } from "@/models/SqlConnectionRow";
import { removeSqlConnectionAction, setSqlConnectionEnabledAction, testSavedSqlConnectionAction } from "./actions";

// One connection: its switch saves at once; to change its string, remove it and add it again. Test signs in with the
// saved string.
export function SqlConnectionRowForm({ connection }: { connection: SqlConnectionRow }) {
  const [isPending, startTransition] = useTransition();
  const [testResult, setTestResult] = useState<ActionResult | null>(null);

  return (
    <div className={`resource-row${connection.enabled ? "" : " off"}`}>
      <label className="row-switch">
        <input type="checkbox" checked={connection.enabled} disabled={isPending} onChange={(event) => startTransition(() => setSqlConnectionEnabledAction(connection.name, event.target.checked))} aria-label={`${connection.name} enabled`} />
        <span className="switch-knob" aria-hidden="true" />
      </label>
      <span className="resource-name-text">{connection.name}</span>
      <span className="resource-target">{connection.server} · {connection.database || "login's default"}</span>
      <span />
      <span className="resource-actions">
        <button type="button" className="secondary small" disabled={isPending} onClick={() => startTransition(async () => setTestResult(await testSavedSqlConnectionAction(connection.name)))}>{isPending ? "…" : "Test"}</button>
        <button type="button" className="danger small" disabled={isPending} onClick={() => startTransition(() => removeSqlConnectionAction(connection.name))}>Remove</button>
      </span>
      {testResult && <span className="resource-result"><ResultLine result={testResult} /></span>}
    </div>
  );
}

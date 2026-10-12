"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/models/ActionResult";
import type { SqlConnectionRow } from "@/models/SqlConnectionRow";
import { removeSqlConnectionAction, setSqlConnectionEnabledAction, testSavedSqlConnectionAction } from "./actions";

// One connection: its switch saves at once; to change its string, remove it and add it again. Test signs in with the
// saved string.
export function SqlConnectionRowForm({ connection }: { connection: SqlConnectionRow }) {
  const [isPending, startTransition] = useTransition();
  const [testResult, setTestResult] = useState<ActionResult | null>(null);

  return (
    <tr className={connection.enabled ? undefined : "muted"}>
      <td>
        <input type="checkbox" checked={connection.enabled} disabled={isPending} onChange={(event) => startTransition(() => setSqlConnectionEnabledAction(connection.name, event.target.checked))} />
      </td>
      <td>{connection.name}</td>
      <td>{connection.server}</td>
      <td>{connection.database || "login's default"}</td>
      <td>
        <button type="button" disabled={isPending} onClick={() => startTransition(async () => setTestResult(await testSavedSqlConnectionAction(connection.name)))}>{isPending ? "…" : "Test"}</button>{" "}
        <button type="button" disabled={isPending} onClick={() => startTransition(() => removeSqlConnectionAction(connection.name))}>Remove</button>
        {testResult && <p className={testResult.ok ? "result-ok" : "result-error"}>{testResult.message}</p>}
      </td>
    </tr>
  );
}

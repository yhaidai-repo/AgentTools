"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { addSqlConnectionAction, testSqlConnectionAction } from "./actions";

// The string is written once and never shown again (like the ADO token). Test checks the typed string without saving;
// it isn't a form action, since React clears a form after one and the string would have to be typed again.
export function AddSqlConnectionForm() {
  const form = useRef<HTMLFormElement>(null);
  const [addResult, addAction, isAdding] = useActionState<ActionResult | null, FormData>(addSqlConnectionAction, null);
  const [testResult, setTestResult] = useState<ActionResult | null>(null);
  const [isTesting, startTest] = useTransition();

  return (
    <form ref={form} action={addAction}>
      <label>
        Connection name (agents pick the connection by it: letters, digits, _ and -)
        <input name="name" placeholder="pvs-local" maxLength={40} required />
      </label>
      <label>
        <span>SQL Server connection string (a local server is <code>host.docker.internal</code> from the agent-runner; a dev server with a self-signed certificate needs <code>TrustServerCertificate=True</code>)</span>
        <input name="connectionString" type="password" autoComplete="off" placeholder="Server=host.docker.internal,1433;Database=Pvs;User ID=reader;Password=…;TrustServerCertificate=True" required />
      </label>
      <div className="actions">
        <button type="submit" disabled={isAdding}>{isAdding ? "Adding…" : "Add connection"}</button>
        <button type="button" disabled={isTesting} className="secondary" onClick={() => startTest(async () => setTestResult(await testSqlConnectionAction(null, new FormData(form.current!))))}>
          {isTesting ? "Testing…" : "Test"}
        </button>
      </div>
      {testResult && <p className={testResult.ok ? "result-ok" : "result-error"}>Test: {testResult.message}</p>}
      {addResult && <p className={addResult.ok ? "result-ok" : "result-error"}>{addResult.message}</p>}
    </form>
  );
}

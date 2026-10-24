"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { ResultLine } from "@/components/ResultLine";
import type { ActionResult } from "@/models/ActionResult";
import { addSqlConnectionAction, testSqlConnectionAction } from "./actions";

// Folded until wanted (user decision 2026-10-18). The string is written once and never shown again (like the ADO
// token). Test checks the typed string without saving; it isn't a form action, since React clears a form after one and
// the string would have to be typed again.
export function AddSqlConnectionForm() {
  const form = useRef<HTMLFormElement>(null);
  const [addResult, addAction, isAdding] = useActionState<ActionResult | null, FormData>(addSqlConnectionAction, null);
  const [testResult, setTestResult] = useState<ActionResult | null>(null);
  const [isTesting, startTest] = useTransition();

  return (
    <details className="add-form">
      <summary>+ Add a connection</summary>
      <form ref={form} action={addAction}>
        <div className="field-grid">
          <label className="field"><span>Name<small>agents pick the connection by it: letters, digits, _ and -</small></span><input name="name" placeholder="pvs-local" maxLength={40} required /></label>
          <label className="field"><span>Connection string<small>a local server is host.docker.internal; a self-signed dev server needs TrustServerCertificate=True</small></span><input name="connectionString" type="password" autoComplete="off" placeholder="Server=host.docker.internal,1433;Database=Pvs;User ID=reader;Password=…" required /></label>
        </div>
        <div className="actions">
          <button type="button" disabled={isTesting} className="secondary" onClick={() => startTest(async () => setTestResult(await testSqlConnectionAction(null, new FormData(form.current!))))}>{isTesting ? "Testing…" : "Test"}</button>
          <button type="submit" disabled={isAdding}>{isAdding ? "Adding…" : "Add connection"}</button>
          <ResultLine result={testResult} />
          <ResultLine result={addResult} />
        </div>
      </form>
    </details>
  );
}

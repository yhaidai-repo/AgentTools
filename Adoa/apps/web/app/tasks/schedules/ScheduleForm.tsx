"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { paramFieldName } from "@/lib/scheduleParams";
import type { ActionResult } from "@/models/ActionResult";
import type { ProducerOption } from "@/models/ProducerOption";
import type { ScheduleFormValues } from "@/models/ScheduleFormValues";
import { saveScheduleAction } from "./actions";

// A scheduled task (user decision 2026-10-03): which agent gets a task, how often a tick checks whether one is needed,
// and the agent's own parameters. The agent's cron (its Config) decides when the task is picked up.
export function ScheduleForm({ values, producers }: { values: ScheduleFormValues; producers: ProducerOption[] }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveScheduleAction, null);
  const [agentId, setAgentId] = useState(values.agentId);
  const producer = producers.find((entry) => entry.agentId === agentId);

  return (
    <form action={action} className="card">
      {values.id !== null && <input type="hidden" name="id" value={values.id} />}
      <label>
        Name
        <input name="name" defaultValue={values.name} required />
      </label>
      <label>
        Agent
        <select name="agentId" value={agentId} onChange={(event) => setAgentId(event.target.value)}>
          {producers.map((entry) => <option key={entry.agentId} value={entry.agentId}>{entry.label}</option>)}
        </select>
      </label>
      {producer && <p className="muted">{producer.description}</p>}
      <label>
        Schedule (cron): how often a task is created when needed
        <input name="cron" defaultValue={values.cron} required />
      </label>
      <label className="inline">
        <input type="checkbox" name="enabled" defaultChecked={values.enabled} />
        Enabled (off = only &quot;Create now&quot;)
      </label>
      {producer?.params.map((param) => (
        <fieldset key={`${agentId}:${param.key}`} className="repo-choices">
          <legend>{param.label}: {param.description}</legend>
          {param.choices.map((choice) => (
            <label key={choice} className="inline">
              <input type="checkbox" name={paramFieldName(param.key)} value={choice} defaultChecked={(values.agentId === agentId ? values.params[param.key] : param.defaultValue)?.includes(choice)} />
              {choice}
            </label>
          ))}
        </fieldset>
      ))}
      <div className="actions">
        <button type="submit" disabled={isSaving || !producer}>{isSaving ? "Saving…" : "Save"}</button>
        <Link className="button secondary" href="/tasks">Cancel</Link>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}

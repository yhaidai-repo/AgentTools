"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import type { AgentChoice } from "@/models/AgentChoice";
import type { ScheduleFormValues } from "@/models/ScheduleFormValues";
import { saveScheduleAction } from "./actions";

// A scheduled task (user decision 2026-10-03; any agent since 2026-10-06): which agent, the goal it works on, the vault's
// repositories it may read, and how often a task is created. The agent's cron (its Config) decides when it is picked up.
export function ScheduleForm({ values, agents, repos }: { values: ScheduleFormValues; agents: AgentChoice[]; repos: string[] }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveScheduleAction, null);
  const [agentId, setAgentId] = useState(values.agentId);
  // An agent with its own task producer (the vault review) needs no goal or repos.
  const takesGoal = agents.find((agent) => agent.id === agentId)?.takesGoal ?? true;

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
          {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.label}</option>)}
        </select>
      </label>
      {takesGoal && <label>
        Goal: what the agent does on each task
        <textarea name="goal" defaultValue={values.goal} rows={5} required placeholder="e.g. Review the error handling of the payment flow and list the gaps." />
      </label>}
      {takesGoal && <fieldset className="repo-choices">
        <legend>Repositories the agent may read (the vault&apos;s enabled ones)</legend>
        {repos.length === 0 && <span className="muted">None enabled: configure them in Settings → Repositories.</span>}
        {repos.map((name) => (
          <label key={name} className="inline">
            <input type="checkbox" name="repos" value={name} defaultChecked={values.repos.includes(name)} />
            {name}
          </label>
        ))}
      </fieldset>}
      <label>
        Schedule (cron): how often a task is created (none while the last one still waits)
        <input name="cron" defaultValue={values.cron} required />
      </label>
      <label className="inline">
        <input type="checkbox" name="enabled" defaultChecked={values.enabled} />
        Enabled (off = only &quot;Create now&quot;)
      </label>
      <div className="actions">
        <button type="submit" disabled={isSaving || agents.length === 0}>{isSaving ? "Saving…" : "Save"}</button>
        <Link className="button secondary" href="/tasks">Cancel</Link>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}

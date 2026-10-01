"use client";

import { useActionState } from "react";
import type { AgentSettings } from "@adoa/core";
import type { ActionResult } from "@/models/ActionResult";
import { saveAgentSettingsAction } from "./agentActions";

export function AgentSettingsForm({ settings }: { settings: AgentSettings }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveAgentSettingsAction, null);
  const stage = settings.refinement;

  return (
    <form action={action} className="card">
      <label>
        Daily budget, all agents ($, API-price estimate)
        <input name="dailyBudgetUsd" type="number" step="0.5" min={0} defaultValue={settings.dailyBudgetUsd} required />
      </label>
      <h2>Refinement agent</h2>
      <label className="inline">
        <input name="enabled" type="checkbox" defaultChecked={stage.enabled} />
        Enabled
      </label>
      <label>
        Schedule (cron)
        <input name="cron" defaultValue={stage.cron} required />
      </label>
      <label>
        PBIs per run
        <input name="batchSize" type="number" min={1} defaultValue={stage.batchSize} required />
      </label>
      <label>
        Model (provider / model id)
        <span className="actions">
          <input name="provider" defaultValue={stage.provider} required />
          <input name="model" defaultValue={stage.model} required />
        </span>
      </label>
      <label>
        Max turns per run
        <input name="maxTurns" type="number" min={1} defaultValue={stage.maxTurns} required />
      </label>
      <label>
        Timeout per run (minutes)
        <input name="timeoutMinutes" type="number" min={1} defaultValue={stage.timeoutMinutes} required />
      </label>
      <label>
        Budget per run ($)
        <input name="perRunBudgetUsd" type="number" step="0.1" min={0} defaultValue={stage.perRunBudgetUsd} required />
      </label>
      <label>
        Daily budget for this agent ($)
        <input name="stageDailyBudgetUsd" type="number" step="0.5" min={0} defaultValue={stage.dailyBudgetUsd} required />
      </label>
      <label>
        Skills (comma-separated)
        <input name="skills" defaultValue={stage.skills.join(", ")} />
      </label>
      <label>
        Failed runs before a PBI is skipped
        <input name="maxFailures" type="number" min={1} defaultValue={stage.maxFailures} required />
      </label>
      <div className="actions">
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save agent settings"}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}

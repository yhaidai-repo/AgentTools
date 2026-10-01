"use client";

import { useActionState } from "react";
import type { BlockerKind } from "@adoa/core";
import type { AgentDefinition, CatalogModel } from "@agenttools/config";
import type { SkillCatalog } from "@agenttools/runtime/skills";
import type { ActionResult } from "@/models/ActionResult";
import type { SkillFolder } from "@/models/SkillFolder";
import { saveAgentAction } from "../../configActions";
import { OptionsFields } from "./OptionsFields";
import { PipelineFields } from "./PipelineFields";
import { SkillsField } from "./SkillsField";

interface AgentFormProps {
  agent: AgentDefinition;
  catalog: CatalogModel[];
  skills: SkillCatalog;
  skillFolders: SkillFolder[];
  agentIds: string[];
  blockerKinds: BlockerKind[];
}

// Generic: renders any agent definition (its declared options included), so new agents need no UI changes.
export function AgentForm({ agent, catalog, skills, skillFolders, agentIds, blockerKinds }: AgentFormProps) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveAgentAction, null);

  return (
    <form action={action} className="card">
      <input type="hidden" name="id" value={agent.id} />
      <p className="muted">{agent.description}</p>
      <label className="inline">
        <input name="enabled" type="checkbox" defaultChecked={agent.enabled} />
        Enabled
      </label>
      <label>
        Schedule (cron, empty = run on demand only)
        <input name="schedule" defaultValue={agent.schedule ?? ""} />
      </label>
      <label>
        Model: provider / model id / effort
        <span className="actions">
          <input name="provider" defaultValue={agent.model.provider} required />
          <input name="model" defaultValue={agent.model.model} list={`models-${agent.id}`} required />
          <select name="effort" defaultValue={agent.model.effort ?? ""}>
            <option value="">default</option>
            {["low", "medium", "high", "xhigh", "max"].map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </span>
        <datalist id={`models-${agent.id}`}>
          {catalog.map((entry) => <option key={`${entry.provider}/${entry.model}`} value={entry.model}>{entry.label}</option>)}
        </datalist>
      </label>
      <label>
        Max turns · timeout (minutes)
        <span className="actions">
          <input name="maxTurns" type="number" min={1} defaultValue={agent.limits.maxTurns} required />
          <input name="timeoutMinutes" type="number" min={1} defaultValue={agent.limits.timeoutMinutes} required />
        </span>
      </label>
      <label>
        Budget per run · per day ($, API-price estimate)
        <span className="actions">
          <input name="perRunUsd" type="number" step="0.1" min={0} defaultValue={agent.budgets.perRunUsd} required />
          <input name="dailyUsd" type="number" step="0.5" min={0} defaultValue={agent.budgets.dailyUsd} required />
        </span>
      </label>
      <label className="inline">
        <input name="webAccess" type="checkbox" defaultChecked={agent.capabilities.webAccess} />
        Web access (search and fetch)
      </label>
      <PipelineFields agent={agent} agentIds={agentIds} blockerKinds={blockerKinds} />
      <SkillsField selected={agent.skills} catalog={skills} folders={skillFolders} />
      <OptionsFields agent={agent} />
      <div className="actions">
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : `Save ${agent.label}`}</button>
      </div>
      {result && <p className={result.ok ? "result-ok" : "result-error"}>{result.message}</p>}
    </form>
  );
}

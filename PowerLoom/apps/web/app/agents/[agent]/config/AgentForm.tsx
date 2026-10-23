"use client";

import { useActionState, useState } from "react";
import type { BlockerKind } from "@powerloom/core";
import type { AgentDefinition, CatalogModel } from "@agenttools/config";
import type { SkillCatalog } from "@agenttools/runtime/skills";
import { CronField } from "@/components/CronField";
import { DailyBudgetStatus } from "@/components/DailyBudgetStatus";
import { FormPicker } from "@/components/FormPicker";
import { SwitchField } from "@/components/SwitchField";
import type { ActionResult } from "@/models/ActionResult";
import type { SkillFolder } from "@/models/SkillFolder";
import type { TaskTypeChoices } from "@/models/TaskTypeChoices";
import { saveAgentAction } from "../../configActions";
import { OptionsFields } from "./OptionsFields";
import { PipelineFields } from "./PipelineFields";
import { DeleteAgentButton } from "./DeleteAgentButton";
import { PromptField, type PromptVersion } from "./PromptField";
import type { PromptFile } from "@/models/PromptFile";
import { SkillsField } from "./SkillsField";

const EFFORTS = ["", "low", "medium", "high", "xhigh", "max"];

interface AgentFormProps {
  agent: AgentDefinition;
  catalog: CatalogModel[];
  skills: SkillCatalog;
  skillFolders: SkillFolder[];
  blockerKinds: BlockerKind[];
  taskTypes: TaskTypeChoices;
  /** This agent's finished runs today, what its daily budget counts. */
  spentTodayUsd: number;
  /** Created in the UI, so it may be deleted; decided on the server (the config package's entry point needs node:fs). */
  removable: boolean;
  /** The prompt file shipped with the code, when the agent has one. */
  promptFile: PromptFile | null;
  /** The stored prompt's earlier versions, newest first. */
  promptVersions: PromptVersion[];
}

// Generic: renders any agent definition (its declared options included), so new agents need no UI changes. Laid out
// like New PBI (user decision 2026-10-18): how it runs, its limits and access on the left; its place in the pipeline,
// skills and options on the right; Save in a bar that stays on screen.
export function AgentForm({ agent, catalog, skills, skillFolders, blockerKinds, taskTypes, spentTodayUsd, removable, promptFile, promptVersions }: AgentFormProps) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveAgentAction, null);

  return (
    <form action={action} className="new-pbi agent-form">
      <input type="hidden" name="id" value={agent.id} />
      <div className="config-columns">
        <div>
          <RunSection agent={agent} catalog={catalog} />
          <LimitsSection agent={agent} spentTodayUsd={spentTodayUsd} />
          <AccessSection agent={agent} />
        </div>
        <div>
          <PipelineFields agent={agent} blockerKinds={blockerKinds} taskTypes={taskTypes} />
          <PromptField stored={agent.prompt ?? ""} storedVersion={agent.promptVersion ?? 0} file={promptFile} versions={promptVersions} />
          <SkillsField agentId={agent.id} selected={agent.skills} catalog={skills} folders={skillFolders} />
          <OptionsFields agent={agent} />
        </div>
      </div>
      <div className="form-footer">
        <span className="form-footer-note">{result ? <span className={result.ok ? "text-ok" : "text-error"}>{result.message}</span> : "Changes apply to the next run"}</span>
        {removable && <DeleteAgentButton agentId={agent.id} label={agent.label} />}
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

// On or off, when it runs (the cron also in words), which model and how hard it thinks.
export function RunSection({ agent, catalog }: { agent: AgentDefinition; catalog: CatalogModel[] }) {
  const [effort, setEffort] = useState(agent.model.effort ?? "");

  return (
    <section className="panel config-section">
      <h3>Run</h3>
      <SwitchField name="enabled" label="Enabled" hint="off = it takes no task and its schedule doesn't fire" defaultChecked={agent.enabled} />
      <CronField label="Schedule" name="schedule" value={agent.schedule ?? ""} hint="cron; empty = on demand only" required={false} />
      <div className="field">
        <span>Model<small>provider and model</small></span>
        <div className="field-row">
          <input name="provider" defaultValue={agent.model.provider} required aria-label="Provider" />
          <FormPicker name="model" label="Model" value={agent.model.model} options={modelChoices(catalog, agent).map((entry) => ({ value: entry.model, label: entry.label, note: entry.model }))} />
        </div>
      </div>
      <div className="field">
        <span>Effort</span>
        <input type="hidden" name="effort" value={effort} />
        <div className="pill-switch">
          {EFFORTS.map((level) => <button key={level} type="button" className={level === effort ? "on" : undefined} onClick={() => setEffort(level)}>{level || "default"}</button>)}
        </div>
      </div>
    </section>
  );
}

export function LimitsSection({ agent, spentTodayUsd }: { agent: AgentDefinition; spentTodayUsd: number }) {
  return (
    <section className="panel config-section">
      <h3>Limits and budget <small>API-price estimate</small></h3>
      <div className="field-grid">
        <label className="field"><span>Max turns</span><input name="maxTurns" type="number" min={1} defaultValue={agent.limits.maxTurns} required /></label>
        <label className="field"><span>Timeout, minutes</span><input name="timeoutMinutes" type="number" min={1} defaultValue={agent.limits.timeoutMinutes} required /></label>
        <label className="field"><span>Budget per run, $</span><input name="perRunUsd" type="number" step="0.1" min={0} defaultValue={agent.budgets.perRunUsd} required /></label>
        <label className="field"><span>Budget per day, $</span><input name="dailyUsd" type="number" step="0.5" min={0} defaultValue={agent.budgets.dailyUsd} required /></label>
      </div>
      <DailyBudgetStatus spentUsd={spentTodayUsd} limitUsd={agent.budgets.dailyUsd} />
    </section>
  );
}

// What the agent may read or run: one switch each, its description as the hint (user decision 2026-10-18).
export function AccessSection({ agent }: { agent: AgentDefinition }) {
  return (
    <section className="panel config-section">
      <h3>Access <small>what it may read or run</small></h3>
      <SwitchField name="webAccess" label="Web" hint="search and fetch" defaultChecked={agent.capabilities.webAccess} />
      {(agent.integrationSpecs ?? []).map((spec) => <SwitchField key={spec.key} name={`integration:${spec.key}`} label={spec.label} hint={spec.description} defaultChecked={agent.capabilities.integrations?.[spec.key] === true} />)}
    </section>
  );
}

// The catalog's models, plus the configured one when the catalog doesn't list it (so saving never changes it silently).
function modelChoices(catalog: CatalogModel[], agent: AgentDefinition): CatalogModel[] {
  const isListed = catalog.some((entry) => entry.model === agent.model.model);

  return isListed ? catalog : [...catalog, { provider: agent.model.provider, model: agent.model.model, label: "Configured" }];
}

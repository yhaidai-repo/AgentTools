"use client";

import Link from "next/link";
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
import { createAgentAction, saveAgentAction } from "../../configActions";
import { IdentitySection } from "./IdentitySection";
import { NewSkillFields } from "./NewSkillFields";
import { OptionsFields } from "./OptionsFields";
import { PipelineFields } from "./PipelineFields";
import { DeleteAgentButton } from "./DeleteAgentButton";
import { PromptField, type PromptVersion } from "./PromptField";
import type { PromptFile } from "@/models/PromptFile";
import { SkillsField } from "./SkillsField";
import { ShippedNoteLine } from "./ShippedNoteLine";
import { KeptForm } from "@/components/KeptForm";

const EFFORTS = ["", "low", "medium", "high", "xhigh", "max"];

interface AgentFormProps {
  agent: AgentDefinition;
  catalog: CatalogModel[];
  skills: SkillCatalog;
  skillFolders: SkillFolder[];
  blockerKinds: BlockerKind[];
  taskTypes: TaskTypeChoices;
  /** This agent's finished runs today, what its daily budget counts. */
  spentTodayUsd: number | null;
  /** Created in the UI, so it may be deleted; decided on the server (the config package's entry point needs node:fs). */
  removable: boolean;
  /** The prompt file shipped with the code, when the agent has one. */
  promptFile: PromptFile | null;
  /** The stored prompt's earlier versions, newest first. */
  promptVersions: PromptVersion[];
  /** The New agent page: the same form on the template's defaults, with an id to type and Create instead of Save. */
  isNew?: boolean;
}

// Generic: renders any agent definition (its declared options included), so new agents need no UI changes. Laid out
// like New PBI (user decision 2026-10-18): who it is, how it runs, its limits and access on the left; its place in the
// pipeline, prompt, skills and options on the right; Save in a bar that stays on screen. The New agent page is the same
// form on the template's defaults (user decision 2026-10-24).
export function AgentForm({ agent, catalog, skills, skillFolders, blockerKinds, taskTypes, spentTodayUsd, removable, promptFile, promptVersions, isNew = false }: AgentFormProps) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(isNew ? createAgentAction : saveAgentAction, null);

  return (
    <KeptForm action={action} className="new-pbi agent-form">
      <div className="config-columns">
        <div>
          <IdentitySection agent={agent} isNew={isNew} />
          <RunSection agent={agent} catalog={catalog} />
          <LimitsSection agent={agent} spentTodayUsd={spentTodayUsd} />
          <AccessSection agent={agent} />
        </div>
        <div>
          <ShippedNoteLine note={agent.shipped?.note} />
          <PipelineFields agent={agent} blockerKinds={blockerKinds} taskTypes={taskTypes} />
          <PromptField stored={agent.prompt ?? ""} storedVersion={agent.promptVersion ?? 0} file={promptFile} versions={promptVersions} hint={<><code>{"{{framework}}"}</code> pulls in the <Link href="/settings?tab=agents">shared framework</Link>; the run&apos;s vault adds its <code>ENVIRONMENT.md</code> rules.</>} />
          <SkillsField agentId={agent.id} selected={agent.skills} catalog={skills} folders={skillFolders} />
          <NewSkillFields suggestedName={isNew ? "" : `${agent.id}-checklist`} />
          <OptionsFields agent={agent} />
        </div>
      </div>
      <div className="form-footer">
        <span className="form-footer-note">{result ? <span className={result.ok ? "text-ok" : "text-error"}>{result.message}</span> : isNew ? "Created with these settings; change them here later" : "Changes apply to the next run"}</span>
        {removable && <DeleteAgentButton agentId={agent.id} label={agent.label} />}
        <button type="submit" disabled={isSaving}>{isNew ? (isSaving ? "Creating…" : "Create") : (isSaving ? "Saving…" : "Save")}</button>
      </div>
    </KeptForm>
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
        <span>Model<small>the provider follows the model</small></span>
        <FormPicker name="model" label="Model" value={agent.model.model} options={modelChoices(catalog, agent).map((entry) => ({ value: entry.model, label: entry.label, note: `${entry.provider} · ${entry.model}` }))} />
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

export function LimitsSection({ agent, spentTodayUsd }: { agent: AgentDefinition; spentTodayUsd: number | null }) {
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
  const specs = agent.integrationSpecs ?? [];
  const owned = specs.filter((spec) => spec.owner === agent.id);

  return (
    <section className="panel config-section">
      <h3>Access <small>what it may read or run</small></h3>
      <SwitchField name="webAccess" label="Web" hint="search and fetch" defaultChecked={agent.capabilities.webAccess} />
      {specs.filter((spec) => spec.owner === undefined).map((spec) => <SwitchField key={spec.key} name={`integration:${spec.key}`} label={spec.label} hint={spec.description} defaultChecked={agent.capabilities.integrations?.[spec.key] === true} />)}
      {owned.length > 0 && <OwnedTools specs={owned} />}
    </section>
  );
}

// The agent's own output tools (user decision 2026-10-28): always on, so they are shown but not posted.
function OwnedTools({ specs }: { specs: AgentDefinition["integrationSpecs"] }) {
  return (
    <div className="owned-tools">
      <h4>Part of this agent</h4>
      {specs.map((spec) => <OwnedTool key={spec.key} spec={spec} />)}
    </div>
  );
}

function OwnedTool({ spec }: { spec: AgentDefinition["integrationSpecs"][number] }) {
  return (
    <label className="switch-field">
      <input type="checkbox" checked disabled readOnly />
      <span className="switch-knob" aria-hidden="true" />
      <span className="switch-text">{spec.label}<small>{spec.description}</small></span>
    </label>
  );
}

// The catalog's models, plus the configured one when the catalog doesn't list it (so saving never changes it silently).
function modelChoices(catalog: CatalogModel[], agent: AgentDefinition): CatalogModel[] {
  const isListed = catalog.some((entry) => entry.model === agent.model.model);

  return isListed ? catalog : [...catalog, { provider: agent.model.provider, model: agent.model.model, label: "Configured" }];
}

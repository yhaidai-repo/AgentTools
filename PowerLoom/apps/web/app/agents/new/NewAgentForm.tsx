"use client";

import type { AgentDefinition, CatalogModel } from "@agenttools/config";
import type { SkillCatalog } from "@agenttools/runtime/skills";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { ActionResult } from "@/models/ActionResult";
import { AccessSection, LimitsSection, RunSection } from "../[agent]/config/AgentForm";
import { OptionsFields } from "../[agent]/config/OptionsFields";
import { createAgentAction } from "../configActions";
import { NewSkillFields } from "./NewSkillFields";

interface NewAgentFormProps {
  /** The defaults the agent starts from; the advanced section edits them. */
  template: AgentDefinition;
  catalog: CatalogModel[];
  skills: SkillCatalog;
  taskTypes: string[];
}

const ID_PATTERN = "[a-z][a-z0-9-]*";

// What a new agent is (user decision 2026-10-23): a prompt, the skills it may load (existing ones, or a new one written
// here), the task types it takes, and defaults for everything else under Advanced. The id is fixed once created.
export function NewAgentForm({ template, catalog, skills, taskTypes }: NewAgentFormProps) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(createAgentAction, null);
  const [id, setId] = useState("");

  return (
    <form action={action} className="config-form">
      <div className="config-columns">
        <div>
          <section className="config-section">
            <h2>Agent</h2>
            <label className="field"><span>Id</span><input name="id" value={id} onChange={(event) => setId(event.target.value)} pattern={ID_PATTERN} placeholder="security-review" required /></label>
            <p className="field-hint">Lower-case letters, digits and dashes; it names the agent in tasks and runs and can&apos;t change later.</p>
            <label className="field"><span>Label</span><input name="label" placeholder="Security review" required /></label>
            <label className="field"><span>Shown on the Agents page</span><input name="description" placeholder="One line on what it does" /></label>
          </section>
          <section className="config-section">
            <h2>Prompt</h2>
            <label className="field">
              <span>Instructions</span>
              <textarea name="prompt" rows={16} spellCheck={false} placeholder={"{{framework}}\n\n## Your job\n…"} />
            </label>
            <p className="field-hint">Saved as its version 1. <code>{"{{framework}}"}</code> inserts the shared framework; <code>{"{{team}}"}</code> and <code>{"{{agent}}"}</code> are filled per run.</p>
          </section>
          <section className="config-section">
            <h2>Takes tasks of these types</h2>
            <div className="switch-list">
              {taskTypes.map((type) => <label key={type} className="switch-field"><input type="checkbox" name="handles" value={type} /><span>{type}</span></label>)}
            </div>
          </section>
        </div>
        <div>
          <section className="config-section">
            <h2>Skills it may load</h2>
            <div className="switch-list">
              {skills.skills.map((skill) => (
                <label key={skill.name} className="switch-field" title={skill.description}>
                  <input type="checkbox" name="skills" value={skill.name} /><span>{skill.name}</span>
                </label>
              ))}
            </div>
            <NewSkillFields suggestedName={id ? `${id}-checklist` : ""} />
          </section>
          <details className="config-section">
            <summary><h2>Advanced</h2></summary>
            <RunSection agent={template} catalog={catalog} />
            <LimitsSection agent={template} spentTodayUsd={0} />
            <AccessSection agent={template} />
            <OptionsFields agent={template} />
          </details>
        </div>
      </div>
      <div className="form-footer">
        <span className="form-footer-note">{result && !result.ok ? <span className="text-error">{result.message}</span> : "Starts disabled; switch it on in its Config once it looks right."}</span>
        <Link className="button secondary" href="/agents">Cancel</Link>
        <button type="submit" disabled={isSaving}>{isSaving ? "Creating…" : "Create"}</button>
      </div>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { SwitchField } from "@/components/SwitchField";
import type { ActionResult } from "@/models/ActionResult";
import { createAgentAction } from "../configActions";

interface AgentChoice {
  id: string;
  label: string;
  description: string;
}

const ID_PATTERN = "[a-z][a-z0-9-]*";

// The id is fixed once created (runs, tasks and labels carry it); everything else changes on the Config page.
export function NewAgentForm({ agents }: { agents: AgentChoice[] }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(createAgentAction, null);
  const [basedOn, setBasedOn] = useState(agents[0]?.id ?? "");
  const base = agents.find((agent) => agent.id === basedOn);

  return (
    <form action={action} className="config-form">
      <section className="config-section">
        <label className="field"><span>Id</span><input name="id" pattern={ID_PATTERN} placeholder="security-review" required /></label>
        <p className="field-hint">Lower-case letters, digits and dashes; it names the agent in tasks and runs and can't change later.</p>
        <label className="field"><span>Label</span><input name="label" placeholder="Security review" required /></label>
        <label className="field"><span>What it does</span><input name="description" placeholder="One line shown on the Agents page" /></label>
        <label className="field">
          <span>Based on</span>
          <select name="basedOn" value={basedOn} onChange={(event) => setBasedOn(event.target.value)}>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.label}</option>)}
          </select>
        </label>
        {base && <p className="field-hint">{base.description}</p>}
        <SwitchField name="copyInstructions" label="Copy its prompt and skills too" hint="off = an empty prompt and no skills" defaultChecked />
        <p className="field-hint">Model, limits, budgets, access and the task types it handles are copied either way; the new agent starts disabled.</p>
      </section>
      <div className="form-footer">
        <span className="form-footer-note">{result && !result.ok && <span className="text-error">{result.message}</span>}</span>
        <Link className="button secondary" href="/agents">Cancel</Link>
        <button type="submit" disabled={isSaving || agents.length === 0}>{isSaving ? "Creating…" : "Create"}</button>
      </div>
    </form>
  );
}

import type { AgentDefinition } from "@agenttools/config";

const ID_PATTERN = "[a-z][a-z0-9-]*";

// What the agent is called: the id (typed only when creating; runs, tasks and labels carry it), its label and the line
// the Agents page shows.
export function IdentitySection({ agent, isNew }: { agent: AgentDefinition; isNew: boolean }) {
  return (
    <section className="panel config-section">
      <h3>Agent</h3>
      {isNew
        ? <label className="field"><span>Id<small>lower-case letters, digits and dashes; fixed once created</small></span><input name="id" pattern={ID_PATTERN} placeholder="security-review" required /></label>
        : <input type="hidden" name="id" value={agent.id} />}
      <label className="field"><span>Label</span><input name="label" defaultValue={isNew ? "" : agent.label} placeholder="Security review" required /></label>
      <label className="field"><span>Description<small>one line on the Agents page</small></span><input name="description" defaultValue={agent.description} /></label>
    </section>
  );
}

// The agent's own instructions, stored with its definition (user decision 2026-10-22): the text a run's system prompt
// starts with. Empty = the prompt file shipped with the code, for the agents that have one.
export function PromptField({ prompt }: { prompt: string }) {
  return (
    <section className="config-section">
      <h2>Prompt</h2>
      <label className="field">
        <span>Instructions</span>
        <textarea name="prompt" rows={14} defaultValue={prompt} spellCheck={false} />
      </label>
      <p className="field-hint">
        Empty: the prompt file shipped with the code, if this agent has one; an agent with neither runs on the shared framework and its task alone.
        {" "}<code>{"{{framework}}"}</code> inserts the shared framework; <code>{"{{team}}"}</code> and <code>{"{{agent}}"}</code> are filled per run.
      </p>
    </section>
  );
}

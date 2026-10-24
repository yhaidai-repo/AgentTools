namespace PowerLoom.Persistence.Entities;

// What one agent run produced, whatever the agent (user decision 2026-10-22): one result per run, kept per run so a
// task's results stay readable as history. Rendered into the backlog vault under the task.
public partial class RunResult
{
    public int Id { get; set; }

    // Null once the run is deleted: the result stays as the task's history.
    public long? RunId { get; set; }

    // Null once the task is deleted.
    public string? TaskId { get; set; }

    // Null for a task without a PBI.
    public int? PbiId { get; set; }

    public string Agent { get; set; } = null!;

    // complete | partial | blocked. Text, not a Postgres enum: the tool validates the set, and an enum can't drop a value.
    public string Status { get; set; } = null!;

    public string Body { get; set; } = null!;

    /// <summary>The agent's structured result (jsonb), in the shape its prompt asked for; null when the body is all.</summary>
    public string? Data { get; set; }

    /// <summary>The evidence the result cites (jsonb, `{ref, note, quote?}[]`); null when none.</summary>
    public string? Evidence { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual AgentRun? Run { get; set; }

    public virtual LocalItem? Task { get; set; }

    public virtual WorkItem? Pbi { get; set; }
}

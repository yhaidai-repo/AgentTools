namespace PowerLoom.Persistence.Entities;

// One saved version of an agent's prompt (user decision 2026-10-23: every edit is a new version). The agent definition
// holds the current text and version number; this is the history the Config page shows and restores from.
public partial class AgentPromptVersion
{
    public int Id { get; set; }

    public string AgentId { get; set; } = null!;

    public int Version { get; set; }

    public string Text { get; set; } = null!;

    public DateTime CreatedAt { get; set; }
}

namespace PowerLoom.Persistence.Entities;

// One outside read by an agent through a tool (Read SQL, Read Azure, Confluence): who, where, the request, the
// outcome and counts; never the returned data (user decision 2026-10-13: every request traceable).
public partial class DataAccess
{
    public int Id { get; set; }

    public string Vault { get; set; } = null!;

    public string AgentId { get; set; } = null!;

    // Null for a chat's read (user decision 2026-10-16; a chat session is not a run).
    public long? RunId { get; set; }

    public string? TaskId { get; set; }

    public int? PbiId { get; set; }

    public string Tool { get; set; } = null!;

    // sql, azure, cosmos, mongo, confluence, localStack, ado.
    public string Kind { get; set; } = null!;

    // The resource's name as Settings shows it, and what it points at.
    public string Resource { get; set; } = null!;

    public string Target { get; set; } = null!;

    // The request as sent: the query, the filter, the queue, the page link.
    public string Request { get; set; } = null!;

    // ok, refused (a guard said no), denied (access), failed.
    public string Outcome { get; set; } = null!;

    public string? Reason { get; set; }

    public int? Rows { get; set; }

    public int? Bytes { get; set; }

    public bool Truncated { get; set; }

    public DateTime StartedAt { get; set; }

    public int DurationMs { get; set; }

    public virtual Vault VaultNavigation { get; set; } = null!;
}

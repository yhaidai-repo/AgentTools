namespace PowerLoom.Persistence.Entities;

// A warning or error a PowerLoom service logged (user decision 2026-10-25: the error trail chats read without Grafana).
// The same message from the same service, about the same task, is one row with a count; rows go after 14 days.
public partial class LogEntry
{
    public int Id { get; set; }

    // backend, runner, mcp.
    public string Service { get; set; } = null!;

    // warn, error.
    public string Level { get; set; } = null!;

    // The latest occurrence's text, cut to 2000 characters.
    public string Message { get; set; } = null!;

    // Service, level, task and the message with its numbers left out: what merges repeats into one row.
    public string Fingerprint { get; set; } = null!;

    public int Count { get; set; }

    public DateTime FirstAt { get; set; }

    public DateTime LastAt { get; set; }

    public long? RunId { get; set; }

    public string? TaskId { get; set; }

    public int? PbiId { get; set; }

    public string? Vault { get; set; }
}

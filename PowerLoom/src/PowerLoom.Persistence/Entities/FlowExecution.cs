using System;

namespace PowerLoom.Persistence.Entities;

// One run of a flow for a PBI or a task: the definition as it was when the run started, and how it ended.
public partial class FlowExecution
{
    public string Id { get; set; } = null!;

    public string FlowId { get; set; } = null!;

    public int FlowVersion { get; set; }

    public string Definition { get; set; } = null!;

    public string Vault { get; set; } = null!;

    public string TargetKind { get; set; } = null!;

    public int? PbiId { get; set; }

    public string? ItemId { get; set; }

    public string Status { get; set; } = null!;

    public string? Error { get; set; }

    public DateTime StartedAt { get; set; }

    public DateTime? FinishedAt { get; set; }

    public virtual Flow Flow { get; set; } = null!;
}

using System;
using System.Collections.Generic;

namespace PowerLoom.Persistence.Entities;

public partial class VaultCapture
{
    public int Id { get; set; }

    public long RunId { get; set; }

    public int PbiId { get; set; }

    public string? ItemId { get; set; }

    public string Title { get; set; } = null!;

    public string Project { get; set; } = null!;

    public string Target { get; set; } = null!;

    public string Captured { get; set; } = null!;

    public string ToFill { get; set; } = null!;

    public string? FilePath { get; set; }

    public DateTime CreatedAt { get; set; }

    public string Name { get; set; } = null!;

    public string Assumptions { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string Errors { get; set; } = null!;

    public virtual LocalItem? Item { get; set; }

    public virtual WorkItem Pbi { get; set; } = null!;

    public virtual AgentRun Run { get; set; } = null!;
}

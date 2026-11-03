using System;
using System.Collections.Generic;

namespace PowerLoom.Persistence.Entities;

// A reusable agent workflow (PowerLoom Flow, phase 1): the canvas definition as JSON, versioned on every save.
public partial class Flow
{
    public string Id { get; set; } = null!;

    public string Vault { get; set; } = null!;

    public string Name { get; set; } = null!;

    public int Version { get; set; }

    public string Definition { get; set; } = null!;

    public string? Trigger { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Vault VaultNavigation { get; set; } = null!;

    public virtual ICollection<FlowExecution> Executions { get; set; } = new List<FlowExecution>();
}

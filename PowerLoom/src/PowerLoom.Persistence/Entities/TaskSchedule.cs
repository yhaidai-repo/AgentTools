using System;
using System.Collections.Generic;

namespace PowerLoom.Persistence.Entities;

public partial class TaskSchedule
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string AgentId { get; set; } = null!;

    public string Cron { get; set; } = null!;

    public bool Enabled { get; set; }

    public string Params { get; set; } = null!;

    public string? TaskType { get; set; }

    public DateTime? LastRunAt { get; set; }

    public string? LastResult { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string Vault { get; set; } = null!;

    public virtual Vault VaultNavigation { get; set; } = null!;
}

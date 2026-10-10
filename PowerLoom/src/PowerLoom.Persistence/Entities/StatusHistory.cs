using System;
using System.Collections.Generic;

using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Entities;

public partial class StatusHistory
{
    public long Id { get; set; }

    public string EntityId { get; set; } = null!;

    public string? FromStatus { get; set; }

    public string ToStatus { get; set; } = null!;

    public DateTime At { get; set; }

    public string Actor { get; set; } = null!;

    public long? RunId { get; set; }

    public EntityKind EntityKind { get; set; }

    public virtual AgentRun? Run { get; set; }
}

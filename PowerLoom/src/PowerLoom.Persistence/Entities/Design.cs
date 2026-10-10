using System;
using System.Collections.Generic;

namespace PowerLoom.Persistence.Entities;

public partial class Design
{
    public int Id { get; set; }

    public int PbiId { get; set; }

    public int Version { get; set; }

    public decimal? EstHumanH { get; set; }

    public decimal? EstAgentH { get; set; }

    public short? Complexity { get; set; }

    public string? Confidence { get; set; }

    public int RiskCount { get; set; }

    public int TestCount { get; set; }

    public long? RunId { get; set; }

    public DateTime CreatedAt { get; set; }

    public string Approach { get; set; } = null!;

    public string Alternatives { get; set; } = null!;

    public string Plan { get; set; } = null!;

    public string Risks { get; set; } = null!;

    public string Tests { get; set; } = null!;

    public string Assumptions { get; set; } = null!;

    public string EstimateBasis { get; set; } = null!;

    public virtual WorkItem Pbi { get; set; } = null!;

    public virtual AgentRun? Run { get; set; }
}

using System;
using System.Collections.Generic;

namespace PowerLoom.Persistence.Entities;

public partial class Refinement
{
    public int Id { get; set; }

    public int PbiId { get; set; }

    public int Version { get; set; }

    public long? RunId { get; set; }

    public string Summary { get; set; } = null!;

    public string ScopeIn { get; set; } = null!;

    public string ScopeOut { get; set; } = null!;

    public string AcGaps { get; set; } = null!;

    public string Dependencies { get; set; } = null!;

    public string Repos { get; set; } = null!;

    public string Assumptions { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string RelevantDocs { get; set; } = null!;

    public string DocsRead { get; set; } = null!;

    public string Skills { get; set; } = null!;

    public virtual WorkItem Pbi { get; set; } = null!;

    public virtual AgentRun? Run { get; set; }
}

using System;
using System.Collections.Generic;

using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Entities;

public partial class Bug
{
    public int WorkItemId { get; set; }

    public int PbiId { get; set; }

    public string ReportedBy { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public PipelineStatus FoundIn { get; set; }

    public BugSource Source { get; set; }

    public virtual WorkItem Pbi { get; set; } = null!;

    public virtual WorkItem WorkItem { get; set; } = null!;
}

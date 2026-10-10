using System;
using System.Collections.Generic;

using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Entities;

public partial class PbiRepo
{
    public int PbiId { get; set; }

    public string RepoId { get; set; } = null!;

    public string? QuestionId { get; set; }

    public RepoSource Source { get; set; }

    public virtual WorkItem Pbi { get; set; } = null!;

    public virtual LocalItem? Question { get; set; }

    public virtual Repo Repo { get; set; } = null!;
}

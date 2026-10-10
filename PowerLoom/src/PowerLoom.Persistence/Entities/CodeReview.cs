using System;
using System.Collections.Generic;

using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Entities;

public partial class CodeReview
{
    public int PrId { get; set; }

    public string? ClosedReason { get; set; }

    public string? ReviewedCommit { get; set; }

    public int? ReviewedIteration { get; set; }

    public string? SummaryMd { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ReviewStatus Status { get; set; }

    public virtual PullRequest Pr { get; set; } = null!;
}

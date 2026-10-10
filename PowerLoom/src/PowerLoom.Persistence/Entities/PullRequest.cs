using System;
using System.Collections.Generic;

namespace PowerLoom.Persistence.Entities;

public partial class PullRequest
{
    public int Id { get; set; }

    public string RepoId { get; set; } = null!;

    public string RepoName { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string? DescriptionMd { get; set; }

    public string? Author { get; set; }

    public string SourceRef { get; set; } = null!;

    public string TargetRef { get; set; } = null!;

    public string SourceCommit { get; set; } = null!;

    public string? TargetCommit { get; set; }

    public int Iteration { get; set; }

    public bool IsDraft { get; set; }

    public string WorkItemIds { get; set; } = null!;

    public string Url { get; set; } = null!;

    public bool IsListed { get; set; }

    public DateTime? AdoCreatedAt { get; set; }

    public DateTime SyncedAt { get; set; }

    public string Vault { get; set; } = null!;

    public virtual CodeReview? CodeReview { get; set; }

    public virtual ICollection<ReviewComment> ReviewComments { get; set; } = new List<ReviewComment>();

    public virtual Vault VaultNavigation { get; set; } = null!;
}

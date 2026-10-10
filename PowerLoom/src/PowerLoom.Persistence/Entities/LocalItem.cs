using System;
using System.Collections.Generic;

using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Entities;

public partial class LocalItem
{
    public string Id { get; set; } = null!;

    public int? PbiId { get; set; }

    public string? ParentId { get; set; }

    public string Title { get; set; } = null!;

    public string Assignee { get; set; } = null!;

    public int Attempts { get; set; }

    public long? CreatedByRun { get; set; }

    public string? VaultPath { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? ClosedAt { get; set; }

    public string? Body { get; set; }

    public string? Data { get; set; }

    public string? Resolution { get; set; }

    public string HeldBy { get; set; } = null!;

    public DateTime? HandedOnAt { get; set; }

    public string Vault { get; set; } = null!;

    public ItemKind Kind { get; set; }

    public ItemStatus Status { get; set; }

    public virtual ICollection<AgentRun> AgentRuns { get; set; } = new List<AgentRun>();

    public virtual ICollection<Attachment> Attachments { get; set; } = new List<Attachment>();

    public virtual AgentRun? CreatedByRunNavigation { get; set; }

    public virtual ICollection<LocalItem> InverseParent { get; set; } = new List<LocalItem>();

    public virtual LocalItem? Parent { get; set; }

    public virtual WorkItem? Pbi { get; set; }

    public virtual ICollection<PbiRepo> PbiRepos { get; set; } = new List<PbiRepo>();

    public virtual ICollection<VaultCapture> VaultCaptures { get; set; } = new List<VaultCapture>();

    public virtual Vault VaultNavigation { get; set; } = null!;
}

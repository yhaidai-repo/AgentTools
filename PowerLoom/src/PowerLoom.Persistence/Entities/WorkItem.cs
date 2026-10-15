using System;
using System.Collections.Generic;

using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Entities;

public partial class WorkItem
{
    public int AdoId { get; set; }

    public string Type { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string AdoState { get; set; } = null!;

    public string? IterationPath { get; set; }

    public string? AreaPath { get; set; }

    public string? AssignedTo { get; set; }

    public int? Priority { get; set; }

    public decimal? Effort { get; set; }

    public decimal? RemainingWork { get; set; }

    public int Rev { get; set; }

    public string ContentHash { get; set; } = null!;

    public DateTime? AdoChangedAt { get; set; }

    public string? VaultPath { get; set; }

    public DateTime SyncedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public double? BacklogPriority { get; set; }

    public string? Tags { get; set; }

    public string? DescriptionMd { get; set; }

    public string? AcceptanceCriteriaMd { get; set; }

    public string? ExtraFieldsMd { get; set; }

    public string? DiscussionMd { get; set; }

    public int? DiscussionRev { get; set; }

    public string Skills { get; set; } = null!;

    public DateTime? SkillsEditedAt { get; set; }

    public string ConfluencePages { get; set; } = null!;

    public string Vault { get; set; } = null!;

    public int? ParentId { get; set; }

    public PipelineStatus PipelineStatus { get; set; }

    public WorkItemSource Source { get; set; }

    public virtual ICollection<AgentRun> AgentRuns { get; set; } = new List<AgentRun>();

    public virtual ICollection<Attachment> Attachments { get; set; } = new List<Attachment>();

    public virtual ICollection<Bug> BugPbis { get; set; } = new List<Bug>();

    public virtual Bug? BugWorkItem { get; set; }

    public virtual ICollection<Design> Designs { get; set; } = new List<Design>();

    public virtual ICollection<WorkItem> InverseParent { get; set; } = new List<WorkItem>();

    public virtual ICollection<LocalItem> LocalItems { get; set; } = new List<LocalItem>();

    public virtual WorkItem? Parent { get; set; }

    public virtual ICollection<PbiFeedback> PbiFeedbacks { get; set; } = new List<PbiFeedback>();

    public virtual ICollection<PbiRepo> PbiRepos { get; set; } = new List<PbiRepo>();

    public virtual ICollection<Refinement> Refinements { get; set; } = new List<Refinement>();

    public virtual ICollection<VaultCapture> VaultCaptures { get; set; } = new List<VaultCapture>();

    public virtual Vault VaultNavigation { get; set; } = null!;
}

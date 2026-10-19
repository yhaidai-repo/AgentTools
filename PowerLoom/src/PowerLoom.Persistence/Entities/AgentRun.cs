using System;
using System.Collections.Generic;

using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Entities;

public partial class AgentRun
{
    public long Id { get; set; }

    public int? PbiId { get; set; }

    public string? ItemId { get; set; }

    public string? PromptVersion { get; set; }

    public string? Model { get; set; }

    public DateTime StartedAt { get; set; }

    public DateTime? EndedAt { get; set; }

    public string? Error { get; set; }

    public string? Input { get; set; }

    public string? Outputs { get; set; }

    public RunOutcome Outcome { get; set; }

    public Stage Stage { get; set; }

    public Guid? ConversationId { get; set; }

    public long? ContinuesRunId { get; set; }

    public virtual AgentRun? ContinuesRun { get; set; }

    public virtual ICollection<AgentRun> ContinuedBy { get; set; } = new List<AgentRun>();

    public virtual ICollection<Design> Designs { get; set; } = new List<Design>();

    public virtual LocalItem? Item { get; set; }

    public virtual ICollection<LocalItem> LocalItems { get; set; } = new List<LocalItem>();

    public virtual WorkItem? Pbi { get; set; }

    public virtual ICollection<Refinement> Refinements { get; set; } = new List<Refinement>();

    public virtual ICollection<ReviewComment> ReviewComments { get; set; } = new List<ReviewComment>();

    public virtual ICollection<StatusHistory> StatusHistories { get; set; } = new List<StatusHistory>();

    public virtual ICollection<VaultCapture> VaultCaptures { get; set; } = new List<VaultCapture>();
}

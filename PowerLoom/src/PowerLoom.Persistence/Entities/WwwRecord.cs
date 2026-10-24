using System;
using System.Collections.Generic;

namespace PowerLoom.Persistence.Entities;

public partial class WwwRecord
{
    public int Id { get; set; }

    public string Vault { get; set; } = null!;

    public string Project { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string Kind { get; set; } = null!;

    public string Planned { get; set; } = null!;

    public string Happened { get; set; } = null!;

    public string Fault { get; set; } = null!;

    public string? RootCause { get; set; }

    public string? Resolution { get; set; }

    public string? PreventiveAction { get; set; }

    public string? Assumptions { get; set; }

    public string Source { get; set; } = null!;

    public string? RecordId { get; set; }

    public DateTime? WrittenAt { get; set; }

    public string? Error { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<PbiFeedback> PbiFeedbacks { get; set; } = new List<PbiFeedback>();
}

using System;
using System.Collections.Generic;

namespace PowerLoom.Persistence.Entities;

public partial class PbiFeedback
{
    public int Id { get; set; }

    public int PbiId { get; set; }

    public short Rating { get; set; }

    public decimal EffortHours { get; set; }

    public int? WwwRecordId { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual WorkItem Pbi { get; set; } = null!;

    public virtual WwwRecord? WwwRecord { get; set; }
}

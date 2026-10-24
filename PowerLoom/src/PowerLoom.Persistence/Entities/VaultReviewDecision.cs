using System;
using System.Collections.Generic;

using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Entities;

public partial class VaultReviewDecision
{
    public int Id { get; set; }

    public string Vault { get; set; } = null!;

    public string Path { get; set; } = null!;

    public string Reasons { get; set; } = null!;

    public DateTime NoteMtime { get; set; }

    public string? TaskId { get; set; }

    public long RunId { get; set; }

    public DateTime DecidedAt { get; set; }

    public string? RecordId { get; set; }
    public VaultReviewAction Action { get; set; }

}

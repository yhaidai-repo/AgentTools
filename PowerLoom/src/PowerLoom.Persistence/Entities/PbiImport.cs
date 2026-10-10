using System;
using System.Collections.Generic;

namespace PowerLoom.Persistence.Entities;

public partial class PbiImport
{
    public int Id { get; set; }

    public string Source { get; set; } = null!;

    public string SourceRef { get; set; } = null!;

    public string? Title { get; set; }

    public string? Sender { get; set; }

    public DateTime? OccurredAt { get; set; }

    public string Results { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string Vault { get; set; } = null!;

    public virtual Vault VaultNavigation { get; set; } = null!;
}

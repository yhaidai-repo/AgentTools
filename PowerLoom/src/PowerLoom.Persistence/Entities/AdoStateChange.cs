using System;
using System.Collections.Generic;

namespace PowerLoom.Persistence.Entities;

public partial class AdoStateChange
{
    public int AdoId { get; set; }

    public int Rev { get; set; }

    public string? FromState { get; set; }

    public string ToState { get; set; } = null!;

    public DateTime ChangedAt { get; set; }
}

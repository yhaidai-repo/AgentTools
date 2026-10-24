using System;
using System.Collections.Generic;

namespace PowerLoom.Persistence.Entities;

public partial class SprintSnapshot
{
    public string IterationPath { get; set; } = null!;

    public DateOnly TakenOn { get; set; }

    public int AdoId { get; set; }

    public string AdoState { get; set; } = null!;

    public decimal? Effort { get; set; }

    public decimal? RemainingWork { get; set; }
}

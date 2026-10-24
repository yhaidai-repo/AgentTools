using System;
using System.Collections.Generic;

namespace PowerLoom.Persistence.Entities;

public partial class DeletedPullRequest
{
    public int Id { get; set; }

    public string Title { get; set; } = null!;

    public DateTime DeletedAt { get; set; }
}

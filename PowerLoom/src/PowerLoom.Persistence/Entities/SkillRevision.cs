using System;
using System.Collections.Generic;

namespace PowerLoom.Persistence.Entities;

public partial class SkillRevision
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string Folder { get; set; } = null!;

    public string Content { get; set; } = null!;

    public DateTime CreatedAt { get; set; }
}

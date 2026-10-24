using System;
using System.Collections.Generic;

namespace PowerLoom.Persistence.Entities;

public partial class Config
{
    public string Key { get; set; } = null!;

    public string Value { get; set; } = null!;

    public DateTime UpdatedAt { get; set; }
}

using System;
using System.Collections.Generic;

using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Entities;

public partial class Repo
{
    public string Id { get; set; } = null!;

    public string AdoProject { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string RemoteUrl { get; set; } = null!;

    public string? DefaultBranch { get; set; }

    public string? Summary { get; set; }

    public bool Excluded { get; set; }

    public DateTime SyncedAt { get; set; }

    public string Vault { get; set; } = null!;

    public RepoKind Kind { get; set; }

    public virtual ICollection<PbiRepo> PbiRepos { get; set; } = new List<PbiRepo>();

    public virtual Vault VaultNavigation { get; set; } = null!;
}

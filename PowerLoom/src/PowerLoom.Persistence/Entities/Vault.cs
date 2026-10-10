using System;
using System.Collections.Generic;

namespace PowerLoom.Persistence.Entities;

public partial class Vault
{
    public string Name { get; set; } = null!;

    public string Features { get; set; } = null!;

    public string? ImportFolder { get; set; }

    public DateTime? RemovedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<LocalItem> LocalItems { get; set; } = new List<LocalItem>();

    public virtual ICollection<PbiImport> PbiImports { get; set; } = new List<PbiImport>();

    public virtual ICollection<PullRequest> PullRequests { get; set; } = new List<PullRequest>();

    public virtual ICollection<Repo> Repos { get; set; } = new List<Repo>();

    public virtual ICollection<TaskSchedule> TaskSchedules { get; set; } = new List<TaskSchedule>();

    public virtual ICollection<VaultNoteWrite> VaultNoteWrites { get; set; } = new List<VaultNoteWrite>();

    public virtual ICollection<WorkItem> WorkItems { get; set; } = new List<WorkItem>();
}

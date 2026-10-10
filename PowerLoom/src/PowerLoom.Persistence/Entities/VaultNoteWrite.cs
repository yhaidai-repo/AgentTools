using System;
using System.Collections.Generic;

using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Entities;

public partial class VaultNoteWrite
{
    public int Id { get; set; }

    public string Path { get; set; } = null!;

    public long RunId { get; set; }

    public DateTime WrittenAt { get; set; }

    public string Vault { get; set; } = null!;

    public NoteWriteAction Action { get; set; }

    public virtual Vault VaultNavigation { get; set; } = null!;
}

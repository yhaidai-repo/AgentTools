using System;
using System.Collections.Generic;

using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Entities;

public partial class Attachment
{
    public int Id { get; set; }

    public int PbiId { get; set; }

    public string? ItemId { get; set; }

    public string? SourceUrl { get; set; }

    public string FileName { get; set; } = null!;

    public string ContentType { get; set; } = null!;

    public int SizeBytes { get; set; }

    public byte[] Content { get; set; } = null!;

    public string? Text { get; set; }

    public string? VaultPath { get; set; }

    public DateTime CreatedAt { get; set; }

    public int? SourceVersion { get; set; }

    public AttachmentOrigin Origin { get; set; }

    public virtual LocalItem? Item { get; set; }

    public virtual WorkItem Pbi { get; set; } = null!;
}

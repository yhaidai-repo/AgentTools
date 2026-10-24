using PowerLoom.Persistence.Enums;

namespace PowerLoom.Infrastructure.Attachments.Models;

// What an upload belongs to: always a PBI, optionally the item it answers and the linked document it replaces.
// `SourceVersion`: the linked page's version when fetched (Confluence).
public sealed record AttachmentTarget(int AdoId, string? ItemId, string? SourceUrl, AttachmentOrigin Origin = AttachmentOrigin.Upload, int? SourceVersion = null);

namespace PowerLoom.Infrastructure.Attachments.Models;

// The text agents read; null for files they can't read yet (images). A file that should have text but has none is
// rejected instead.
public sealed record ExtractedText(string? Text);

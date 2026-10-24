namespace PowerLoom.Infrastructure.Attachments;

public static class AttachmentLimits
{
    public const int MaxBytes = 20 * 1024 * 1024;

    // Files agents read as text; images are accepted but stored only.
    public static readonly string[] ReadableExtensions = [".pdf", ".docx", ".xlsx", ".csv", ".html", ".htm", ".md", ".markdown", ".txt"];
    public static readonly string[] ImageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
    public static readonly string[] AcceptedExtensions = [.. ReadableExtensions, .. ImageExtensions];
}

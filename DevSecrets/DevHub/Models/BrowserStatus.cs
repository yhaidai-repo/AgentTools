namespace DevSecrets.DevHub.Models;

// GET /browser: the open case, if any, and when it closes by itself.
public sealed record BrowserStatus(bool Open, string? Owner, string? Case, string? Url, string? Title, DateTimeOffset? ExpiresAt)
{
    public static readonly BrowserStatus Closed = new(false, null, null, null, null, null);
}

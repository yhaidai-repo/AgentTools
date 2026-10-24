namespace PowerLoom.Features.Cleanup.Models;

// What one cleaner did: its actions, and a note when it did nothing for a reason (off, DevHub unreachable).
public sealed record CleanerResult(IReadOnlyList<CleanupAction> Actions, string? Note = null)
{
    public static CleanerResult Off { get; } = new([], "off (0 days)");

    public static CleanerResult Skipped(string note) => new([], note);
}

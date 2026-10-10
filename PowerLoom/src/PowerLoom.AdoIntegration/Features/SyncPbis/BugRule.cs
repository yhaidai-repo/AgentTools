namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// QA reports an implementation bug as a Task under the PBI with [BUG] in its title (user decision 2026-10-09).
public static class BugRule
{
    public const string Marker = "[BUG]";

    public const string WorkItemType = "Task";

    public static bool IsMarkedBug(string type, string title) => type == WorkItemType && title.Contains(Marker, StringComparison.OrdinalIgnoreCase);
}

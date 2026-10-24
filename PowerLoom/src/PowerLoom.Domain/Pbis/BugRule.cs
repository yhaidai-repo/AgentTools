namespace PowerLoom.Domain.Pbis;

// QA reports an implementation bug as a Task under the PBI with [BUG] in its title (user decision 2026-10-09).
public static class BugRule
{
    public const string Marker = "[BUG]";

    public const string WorkItemType = "Task";

    public static bool IsMarkedBug(string type, string title) => type == WorkItemType && HasMarker(title);

    // A reported bug's title carries the marker like QA's, so both read the same everywhere.
    public static string BugTitle(string title) => HasMarker(title) ? title : $"{Marker} {title}";

    private static bool HasMarker(string title) => title.Contains(Marker, StringComparison.OrdinalIgnoreCase);
}

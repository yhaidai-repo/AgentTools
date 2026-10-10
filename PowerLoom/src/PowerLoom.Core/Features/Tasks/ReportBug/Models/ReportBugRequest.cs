namespace PowerLoom.Features.Tasks.ReportBug.Models;

// The parent PBI as a link or id, and the bug in the reporter's words; `Actor` for status_history ("human", a CLI).
public sealed record ReportBugRequest(string Parent, string Title, string? DescriptionMd, int? Priority, string? Actor);

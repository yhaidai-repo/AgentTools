namespace PowerLoom.Features.Tasks.ReportBug.Models;

// The child item created, and the PBI it was filed under.
public sealed record ReportedBug(int AdoId, int ParentId);

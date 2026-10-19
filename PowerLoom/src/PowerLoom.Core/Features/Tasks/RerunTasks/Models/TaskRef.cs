namespace PowerLoom.Features.Tasks.RerunTasks.Models;

// A task by id, with the PBI it belongs to (null for a task without one). `StartOver`: its next run starts a fresh
// conversation instead of continuing the last run's.
public sealed record TaskRef(int? AdoId, string ItemId, bool StartOver = false);

namespace PowerLoom.Features.Tasks.RerunTasks.Models;

// A task by id, with the PBI it belongs to (null for a task without one).
public sealed record TaskRef(int? AdoId, string ItemId);

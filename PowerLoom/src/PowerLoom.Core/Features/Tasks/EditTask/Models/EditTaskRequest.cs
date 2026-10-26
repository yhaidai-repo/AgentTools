namespace PowerLoom.Features.Tasks.EditTask.Models;

// A task's own text as the user corrects it (user decision 2026-10-26): what the New task form takes, nothing else.
public sealed record EditTaskRequest(int? AdoId, string Title, string Description, string AcceptanceCriteria);

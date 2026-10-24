namespace PowerLoom.Features.Tasks.CreateTask.Models;

// A task the user creates (user decision 2026-10-14): a task type, what to do and when it is done. `Pbi` is a link or an
// id (optional for research); `Repos` apply to research without a PBI. `Actor` for status_history ("human", a CLI).
public sealed record CreateTaskRequest(string Vault, string Type, string Title, string Description, string AcceptanceCriteria, string? Pbi, List<string>? Repos, string? Actor);

namespace PowerLoom.Domain.Tasks.Models;

// A task for the person on a PBI; `Data` is the item's JSON (`key` names its subject so a rerun never creates it twice).
public sealed record NewHumanTask(int AdoId, string Title, string Body, long? RunId, string? Data);

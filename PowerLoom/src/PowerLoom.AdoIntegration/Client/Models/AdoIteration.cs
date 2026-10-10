namespace PowerLoom.AdoIntegration.Client.Models;

public sealed record AdoIteration(string Id, string Name, string Path, string? StartDate, string? FinishDate, string? TimeFrame);

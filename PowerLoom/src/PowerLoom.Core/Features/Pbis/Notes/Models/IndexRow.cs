namespace PowerLoom.Features.Pbis.Notes.Models;

public sealed record IndexRow(int AdoId, string Title, string AdoState, string PipelineStatus, string? IterationPath);

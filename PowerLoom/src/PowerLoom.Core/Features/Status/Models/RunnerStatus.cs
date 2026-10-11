namespace PowerLoom.Features.Status.Models;

public sealed record RunnerStatus(StateLevel State, bool Reachable, string? RunningTask, string Url, string? Detail);

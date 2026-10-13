namespace DevSecrets.DevHub.Models;

// GET /stack: DevHub's operation plus what the scripts see running.
public sealed record StackStatus(
    StackPhase Phase,
    bool Running,
    string[] RequestedServices,
    string? Branch,
    DateTimeOffset? StartedAt,
    DateTimeOffset? ExpiresAt,
    int? ExitCode,
    string? Owner,
    ScriptServiceStatus[] Services,
    IReadOnlyList<string> Output
);

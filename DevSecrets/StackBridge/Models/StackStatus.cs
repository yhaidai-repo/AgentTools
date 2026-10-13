namespace DevSecrets.StackBridge.Models;

// GET /stack: the bridge's operation plus what the scripts see running.
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

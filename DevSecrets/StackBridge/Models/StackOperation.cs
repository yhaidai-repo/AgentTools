namespace DevSecrets.StackBridge.Models;

public sealed record StackOperation(
    StackPhase Phase,
    string[] Services,
    string? Branch,
    DateTimeOffset? StartedAt,
    DateTimeOffset? ExpiresAt,
    int? ExitCode,
    string? Owner
)
{
    public static readonly StackOperation Idle = new(StackPhase.Idle, [], null, null, null, null, null);
}

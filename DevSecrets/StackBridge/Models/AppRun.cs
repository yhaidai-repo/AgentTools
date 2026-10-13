namespace DevSecrets.StackBridge.Models;

// How the stack runner starts an app (services.json "run"); Kind is set for non-dotnet apps (the RabbitMQ container).
public sealed record AppRun(
    string? Kind,
    string? Project,
    string? LaunchProfile,
    string? ReadyLog,
    string? ReadyProcess,
    string? ManagementUrl,
    IReadOnlyDictionary<string, string> RequiresEnv
);

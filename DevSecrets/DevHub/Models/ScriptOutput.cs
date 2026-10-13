namespace DevSecrets.DevHub.Models;

public sealed record ScriptOutput(int ExitCode, IReadOnlyList<string> Lines);

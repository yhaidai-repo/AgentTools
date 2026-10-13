namespace DevSecrets.StackBridge.Models;

public sealed record ScriptOutput(int ExitCode, IReadOnlyList<string> Lines);

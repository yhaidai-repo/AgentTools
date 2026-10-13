namespace DevSecrets.DevHub.Models;

// How the stack runner starts an app. Fields the form doesn't know (kind, managementUrl, denoScripts) stay as they are.
public sealed record SaveRunRequest(string? Project, string? LaunchProfile, string? ReadyLog, string? ReadyProcess, Dictionary<string, string>? RequiresEnv);

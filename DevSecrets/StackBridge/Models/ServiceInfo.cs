namespace DevSecrets.StackBridge.Models;

// One runnable service of services.json, as agents see it.
public sealed record ServiceInfo(string Name, string? Note, string? LocalUrl, bool ConsumesBus);

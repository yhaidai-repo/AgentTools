namespace DevSecrets.DevHub.Models;

// One runnable service of services.json, as agents see it. Configurable: what a start's Config may set for it
// (e.g. "workers"); empty for a service that takes none.
public sealed record ServiceInfo(string Name, string? Note, string? LocalUrl, bool ConsumesBus, string[] Configurable);

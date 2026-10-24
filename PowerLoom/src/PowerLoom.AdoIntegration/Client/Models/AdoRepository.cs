namespace PowerLoom.AdoIntegration.Client.Models;

public sealed record AdoRepository(string Id, string Name, string Project, string RemoteUrl, string? DefaultBranch, bool IsDisabled);

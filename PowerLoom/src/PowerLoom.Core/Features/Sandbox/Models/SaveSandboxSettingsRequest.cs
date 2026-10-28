namespace PowerLoom.Features.Sandbox.Models;

public sealed record SaveSandboxSettingsRequest(List<string>? PackageHosts, string? Image);

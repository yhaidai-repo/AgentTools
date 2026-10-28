namespace PowerLoom.Features.Sandbox.Models;

// The stored `sandbox` row of a vault, read by the agent-runner (SandboxSettings); the defaults match the TypeScript
// side's (DEFAULT_PACKAGE_HOSTS).
public sealed class SandboxSetting
{
    // The public registries only (user decision 2026-10-29); the vault's own Azure DevOps feeds are added by the runner.
    public static readonly string[] DefaultPackageHosts = ["api.nuget.org", "registry.npmjs.org"];

    // The hosts the vault's package restores may reach: exact names or `*.domain`.
    public List<string> PackageHosts { get; set; } = [.. DefaultPackageHosts];

    // A name from the sandbox image catalog; empty for the catalog's first image.
    public string Image { get; set; } = "";
}

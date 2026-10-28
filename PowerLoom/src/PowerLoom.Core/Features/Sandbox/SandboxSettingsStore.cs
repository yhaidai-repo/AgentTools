using System.Text.RegularExpressions;
using PowerLoom.Contracts;
using PowerLoom.Features.Sandbox.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.Features.Sandbox;

// Settings → Data access → Sandbox (design agent-sandbox, phase 3b): the hosts a vault's package restores may reach and
// the image its sandboxes start from. The agent-runner reads the same key for every restore and sandbox.
public sealed partial class SandboxSettingsStore(PowerLoomDbContext db)
{
    // The TypeScript side reads the same key (SANDBOX_KEY).
    public const string Key = "sandbox";

    // A restore reaches a handful of hosts; the bound only keeps a pasted list from growing without end.
    private const int MaxHosts = 50;

    public async Task<SandboxSetting> ReadAsync(string vault, CancellationToken cancellation) => await VaultSettings.ReadAsync<SandboxSetting>(db, vault, Key, cancellation) ?? new SandboxSetting();

    public async Task<Outcome<SandboxSetting>> SaveAsync(string vault, SaveSandboxSettingsRequest request, CancellationToken cancellation)
    {
        var setting = SettingOf(request);
        var problem = ProblemWith(setting);

        if (problem is not null)
            return Outcome<SandboxSetting>.Failure(Problem.Invalid(problem));

        await VaultSettings.SaveAsync(db, vault, Key, setting, cancellation);

        return Outcome<SandboxSetting>.Success(setting);
    }

    private static SandboxSetting SettingOf(SaveSandboxSettingsRequest request) => new()
    {
        PackageHosts = (request.PackageHosts ?? []).Select(host => host.Trim().ToLowerInvariant()).Where(host => host.Length > 0).Distinct().ToList(),
        Image = request.Image?.Trim() ?? "",
    };

    private static string? ProblemWith(SandboxSetting setting)
    {
        var badHost = setting.PackageHosts.FirstOrDefault(host => !HostPattern().IsMatch(host));

        if (badHost is not null)
            return $"Not a host name: {badHost}. Give names like api.nuget.org, or *.example.com for every host under it.";

        if (setting.PackageHosts.Count > MaxHosts)
            return $"At most {MaxHosts} package hosts.";

        return setting.Image.Length == 0 || ImagePattern().IsMatch(setting.Image) ? null : $"Not an image name of the catalog: {setting.Image}.";
    }

    [GeneratedRegex(@"^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$")]
    private static partial Regex HostPattern();

    [GeneratedRegex("^[a-z0-9][a-z0-9._-]*$")]
    private static partial Regex ImagePattern();
}

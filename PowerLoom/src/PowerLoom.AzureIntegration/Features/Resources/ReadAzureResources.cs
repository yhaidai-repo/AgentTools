using System.Text.RegularExpressions;
using PowerLoom.AzureIntegration.Features.Resources.Models;
using PowerLoom.AzureIntegration.Settings;
using PowerLoom.Contracts;

namespace PowerLoom.AzureIntegration.Features.Resources;

// Settings → Read Azure: each kind's switch and the resources. A resource is added once and then only switched or
// removed; its secret is never read back by the page.
public sealed partial class ReadAzureResources(ReadAzureSettingsStore store)
{
    public async Task<Outcome<bool>> SetKindEnabledAsync(string vault, string kind, bool enabled, CancellationToken cancellation)
    {
        if (!AzureResourceKinds.IsKnown(kind))
            return Outcome<bool>.Failure(UnknownKind(kind));

        var settings = await store.ReadAsync(vault, cancellation);

        settings.EnabledKinds[kind] = enabled;
        await store.SaveAsync(vault, settings, cancellation);

        return Outcome<bool>.Success(enabled);
    }

    public async Task<Outcome<AzureResourceSettings>> AddAsync(string vault, string name, string kind, string target, string secret, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);
        var problem = ProblemOf(settings, name.Trim(), kind.Trim());

        if (problem is not null)
            return Outcome<AzureResourceSettings>.Failure(problem);

        var resolved = AzureTargets.Resolve(kind.Trim(), target.Trim(), secret.Trim());

        if (!resolved.Ok)
            return Outcome<AzureResourceSettings>.Failure(resolved.Problem);

        var resource = NewResource(name.Trim(), kind.Trim(), resolved.Value);

        settings.Resources.Add(resource);
        await store.SaveAsync(vault, settings, cancellation);

        return Outcome<AzureResourceSettings>.Success(resource);
    }

    public async Task<Outcome<AzureResourceSettings>> SetResourceEnabledAsync(string vault, string name, bool enabled, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);
        var resource = settings.Find(name);

        if (resource is null)
            return Outcome<AzureResourceSettings>.Failure(NotFound(name));

        resource.Enabled = enabled;
        await store.SaveAsync(vault, settings, cancellation);

        return Outcome<AzureResourceSettings>.Success(resource);
    }

    public async Task RemoveAsync(string vault, string name, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);
        var removed = settings.Resources.RemoveAll(resource => resource.Name.Equals(name, StringComparison.OrdinalIgnoreCase));

        if (removed > 0)
            await store.SaveAsync(vault, settings, cancellation);
    }

    private static Problem? ProblemOf(ReadAzureSettings settings, string name, string kind)
    {
        if (!ResourceName().IsMatch(name))
            return Problem.Invalid("A resource name is 1–40 letters, digits, '_' or '-'; agents pick the resource by it.");

        if (settings.Find(name) is not null)
            return Problem.Conflict($"{name} is a resource of this vault already: remove it first to replace it.");

        return AzureResourceKinds.IsKnown(kind) ? null : UnknownKind(kind);
    }

    private static AzureResourceSettings NewResource(string name, string kind, AzureResourceTarget resolved)
    {
        return new AzureResourceSettings { Name = name, Kind = kind, Target = resolved.Target, Secret = resolved.Secret, Display = resolved.Display, Enabled = true };
    }

    private static Problem UnknownKind(string kind) => Problem.Invalid($"Unknown kind {kind}; one of {string.Join(", ", AzureResourceKinds.All)}.");

    private static Problem NotFound(string name) => Problem.NotFound($"{name} isn't a resource of this vault.");

    [GeneratedRegex(@"^[A-Za-z0-9_-]{1,40}$")]
    private static partial Regex ResourceName();
}

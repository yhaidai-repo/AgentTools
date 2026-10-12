using System.Text.RegularExpressions;
using PowerLoom.AzureIntegration.Settings;
using PowerLoom.Contracts;

namespace PowerLoom.AzureIntegration.Features.Resources;

// Settings → Read Azure: the vault's switch, its service principal and its resources. A resource is added once and
// then only switched or removed; a Mongo string is never read back by the page.
public sealed partial class ReadAzureResources(ReadAzureSettingsStore store)
{
    public async Task SetEnabledAsync(string vault, bool enabled, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);

        settings.Enabled = enabled;
        await store.SaveAsync(vault, settings, cancellation);
    }

    // An empty secret keeps the saved one; the first save needs one.
    public async Task<Outcome<AzureIdentitySettings>> SaveIdentityAsync(string vault, string tenantId, string clientId, string? clientSecret, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);
        var secret = string.IsNullOrWhiteSpace(clientSecret) ? settings.Identity?.ClientSecret ?? "" : clientSecret.Trim();

        if (!Guid.TryParse(tenantId.Trim(), out _) || !Guid.TryParse(clientId.Trim(), out _))
            return Outcome<AzureIdentitySettings>.Failure(Problem.Invalid("The tenant id and the client (application) id are GUIDs from the app registration's Overview."));

        if (secret.Length == 0)
            return Outcome<AzureIdentitySettings>.Failure(Problem.Invalid("A client secret is required."));

        settings.Identity = new AzureIdentitySettings { TenantId = tenantId.Trim(), ClientId = clientId.Trim(), ClientSecret = secret };
        await store.SaveAsync(vault, settings, cancellation);

        return Outcome<AzureIdentitySettings>.Success(settings.Identity);
    }

    public async Task<Outcome<AzureResourceSettings>> AddAsync(string vault, string name, string kind, string target, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);
        var problem = ProblemOf(settings, name.Trim(), kind.Trim(), target.Trim());

        if (problem is not null)
            return Outcome<AzureResourceSettings>.Failure(problem);

        var resource = new AzureResourceSettings { Name = name.Trim(), Kind = kind.Trim(), Target = target.Trim(), Display = AzureTargets.DisplayOf(kind.Trim(), target.Trim()), Enabled = true };

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

    private static Problem? ProblemOf(ReadAzureSettings settings, string name, string kind, string target)
    {
        if (!ResourceName().IsMatch(name))
            return Problem.Invalid("A resource name is 1–40 letters, digits, '_' or '-'; agents pick the resource by it.");

        if (settings.Find(name) is not null)
            return Problem.Conflict($"{name} is a resource of this vault already: remove it first to replace it.");

        if (!AzureResourceKinds.IsKnown(kind))
            return Problem.Invalid($"Unknown kind {kind}; one of {string.Join(", ", AzureResourceKinds.All)}.");

        return AzureTargets.ProblemOf(kind, target);
    }

    private static Problem NotFound(string name) => Problem.NotFound($"{name} isn't a resource of this vault.");

    [GeneratedRegex(@"^[A-Za-z0-9_-]{1,40}$")]
    private static partial Regex ResourceName();
}

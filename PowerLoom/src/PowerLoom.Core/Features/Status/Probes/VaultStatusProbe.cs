using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Features.ImportSources;
using PowerLoom.Features.ImportSources.Models;
using PowerLoom.Features.Status.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.Features.Status.Probes;

// Reads each vault's settings rows as the libraries wrote them; Core doesn't reference the ADO library, so the ADO
// settings are read as JSON (keys `enabled`, `orgUrl`, `project`, `team`, `user`, `pat`).
public sealed class VaultStatusProbe(PowerLoomDbContext db)
{
    private const string AdoKey = "ado";
    private const string ImportStatusKey = "importStatus";

    private static readonly string[] AdoRequired = ["orgUrl", "project", "team", "user", "pat"];

    public async Task<List<VaultStatus>> ReadAsync(CancellationToken cancellation)
    {
        var names = await db.Vaults.AsNoTracking().Where(vault => vault.RemovedAt == null).OrderBy(vault => vault.Name).Select(vault => vault.Name).ToListAsync(cancellation);
        var statuses = new List<VaultStatus>();

        foreach (var name in names)
            statuses.Add(await ReadVaultAsync(name, cancellation));

        return statuses;
    }

    private async Task<VaultStatus> ReadVaultAsync(string vault, CancellationToken cancellation)
    {
        var (enabled, configured) = AdoOf(await VaultSettings.ReadRawAsync(db, vault, AdoKey, cancellation));
        var import = await VaultSettings.ReadAsync<ImportRunStatus>(db, vault, ImportStatusKey, cancellation);
        var lastPbi = await db.WorkItems.AsNoTracking().Where(item => item.Vault == vault).MaxAsync(item => (DateTime?)item.SyncedAt, cancellation);
        var lastPr = await db.PullRequests.AsNoTracking().Where(pr => pr.Vault == vault).MaxAsync(pr => (DateTime?)pr.SyncedAt, cancellation);

        return new VaultStatus(vault, enabled, configured, Utc(lastPbi), Utc(lastPr), import?.Configured ?? false, import?.CheckedAt);
    }

    private static (bool Enabled, bool Configured) AdoOf(string? json)
    {
        if (json is null)
            return (false, false);

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var enabled = root.TryGetProperty("enabled", out var flag) && flag.ValueKind == JsonValueKind.True;
        var configured = AdoRequired.All(key => root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString()));

        return (enabled, configured);
    }

    private static DateTimeOffset? Utc(DateTime? time) => time is null ? null : new DateTimeOffset(DateTime.SpecifyKind(time.Value, DateTimeKind.Utc));
}

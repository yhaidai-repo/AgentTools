using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace PowerLoom.Persistence.Vaults;

// `vault.features`: what PowerLoom does for a vault, each switch saved with its feature's settings (user decision 2026-10-06).
public static class VaultFeatures
{
    public const string AdoSync = "adoSync";
    public const string MailSync = "mailSync";
    public const string PullRequests = "pullRequests";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task SetAsync(PowerLoomDbContext db, string vault, string feature, bool enabled, CancellationToken cancellation)
    {
        var row = await db.Vaults.SingleAsync(entry => entry.Name == vault, cancellation);
        var features = JsonSerializer.Deserialize<Dictionary<string, bool>>(row.Features, Json) ?? [];

        features[feature] = enabled;
        row.Features = JsonSerializer.Serialize(features, Json);

        await db.SaveChangesAsync(cancellation);
    }

    public static async Task<bool> IsOnAsync(PowerLoomDbContext db, string vault, string feature, CancellationToken cancellation)
    {
        var stored = await db.Vaults.Where(entry => entry.Name == vault).Select(entry => entry.Features).SingleOrDefaultAsync(cancellation);
        var features = stored is null ? [] : JsonSerializer.Deserialize<Dictionary<string, bool>>(stored, Json) ?? [];

        return features.GetValueOrDefault(feature);
    }
}

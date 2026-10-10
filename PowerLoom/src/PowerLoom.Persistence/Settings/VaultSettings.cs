using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Settings;

// adoa's `config` table: one JSON value per key. Settings are per vault (user decision 2026-10-05): the key is
// `vault:<name>:<setting>`; the JSON keeps the camelCase names the TypeScript side reads.
public static class VaultSettings
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static string KeyOf(string vault, string setting) => $"vault:{vault}:{setting}";

    public static async Task<T?> ReadAsync<T>(PowerLoomDbContext db, string vault, string setting, CancellationToken cancellation)
        where T : class
    {
        var value = await db.Configs.Where(row => row.Key == KeyOf(vault, setting)).Select(row => row.Value).SingleOrDefaultAsync(cancellation);

        return value is null ? null : JsonSerializer.Deserialize<T>(value, Json);
    }

    public static Task<string?> ReadRawAsync(PowerLoomDbContext db, string vault, string setting, CancellationToken cancellation)
    {
        return db.Configs.Where(row => row.Key == KeyOf(vault, setting)).Select(row => row.Value).SingleOrDefaultAsync(cancellation);
    }

    public static async Task SaveAsync<T>(PowerLoomDbContext db, string vault, string setting, T value, CancellationToken cancellation)
    {
        var key = KeyOf(vault, setting);
        var row = await db.Configs.SingleOrDefaultAsync(entry => entry.Key == key, cancellation);

        if (row is null)
            db.Configs.Add(row = new Config { Key = key, Value = "" });

        row.Value = JsonSerializer.Serialize(value, Json);
        row.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);
    }
}

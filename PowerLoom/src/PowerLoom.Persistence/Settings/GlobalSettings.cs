using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Settings;

// PowerLoom's `config` table: one JSON value per key. A global setting (one for the whole PowerLoom, e.g. Settings → AI
// providers) is stored under its plain key; the JSON keeps the camelCase names the TypeScript side reads.
public static class GlobalSettings
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task<T?> ReadAsync<T>(PowerLoomDbContext db, string key, CancellationToken cancellation)
        where T : class
    {
        var value = await ReadRawAsync(db, key, cancellation);

        return value is null ? null : JsonSerializer.Deserialize<T>(value, Json);
    }

    public static Task<string?> ReadRawAsync(PowerLoomDbContext db, string key, CancellationToken cancellation)
    {
        return db.Configs.Where(row => row.Key == key).Select(row => row.Value).SingleOrDefaultAsync(cancellation);
    }

    public static async Task SaveAsync<T>(PowerLoomDbContext db, string key, T value, CancellationToken cancellation)
    {
        var row = await db.Configs.SingleOrDefaultAsync(entry => entry.Key == key, cancellation);

        if (row is null)
            db.Configs.Add(row = new Config { Key = key, Value = "" });

        row.Value = JsonSerializer.Serialize(value, Json);
        row.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);
    }

    public static async Task DeleteAsync(PowerLoomDbContext db, string key, CancellationToken cancellation)
    {
        await db.Configs.Where(row => row.Key == key).ExecuteDeleteAsync(cancellation);
    }
}

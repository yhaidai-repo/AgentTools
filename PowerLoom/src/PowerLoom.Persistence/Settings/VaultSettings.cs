namespace PowerLoom.Persistence.Settings;

// PowerLoom's `config` table: one JSON value per key. Settings are per vault (user decision 2026-10-05): the key is
// `vault:<name>:<setting>`; the JSON keeps the camelCase names the TypeScript side reads.
public static class VaultSettings
{
    public static string KeyOf(string vault, string setting) => $"vault:{vault}:{setting}";

    public static Task<T?> ReadAsync<T>(PowerLoomDbContext db, string vault, string setting, CancellationToken cancellation)
        where T : class
    {
        return GlobalSettings.ReadAsync<T>(db, KeyOf(vault, setting), cancellation);
    }

    public static Task<string?> ReadRawAsync(PowerLoomDbContext db, string vault, string setting, CancellationToken cancellation)
    {
        return GlobalSettings.ReadRawAsync(db, KeyOf(vault, setting), cancellation);
    }

    public static Task SaveAsync<T>(PowerLoomDbContext db, string vault, string setting, T value, CancellationToken cancellation)
    {
        return GlobalSettings.SaveAsync(db, KeyOf(vault, setting), value, cancellation);
    }
}

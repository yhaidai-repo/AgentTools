namespace PowerLoom.SqlIntegration.Settings;

// A vault's Read SQL (user decision 2026-10-12): agents with the integration switched on read these SQL Server
// databases while the vault's switch is on. Any database the user adds; no host allow-list.
public sealed class ReadSqlSettings
{
    public bool Enabled { get; set; }

    public List<SqlConnectionSettings> Connections { get; set; } = [];

    public SqlConnectionSettings? Find(string name) => Connections.Find(connection => connection.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
}

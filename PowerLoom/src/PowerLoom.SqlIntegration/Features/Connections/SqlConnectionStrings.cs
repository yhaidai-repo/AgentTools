using System.Data.Common;
using PowerLoom.SqlIntegration.Features.Connections.Models;

namespace PowerLoom.SqlIntegration.Features.Connections;

// Reads a SQL Server connection string's keys without a SQL driver: the backend only stores connections, the
// agent-runner's driver connects (user decision 2026-10-12; SqlClient refuses the backend's invariant globalization).
public static class SqlConnectionStrings
{
    public const string NotAConnectionString = "Not a SQL Server connection string: it needs at least a Server (Data Source).";

    private static readonly string[] ServerKeys = ["Server", "Data Source", "Address", "Addr", "Network Address"];
    private static readonly string[] DatabaseKeys = ["Database", "Initial Catalog"];

    // Null when the text isn't `key=value;` pairs, or names no server.
    public static SqlConnectionTarget? Parse(string connectionString)
    {
        var keys = KeysOf(connectionString);
        var server = keys is null ? "" : FirstValue(keys, ServerKeys);

        return server.Length == 0 ? null : new SqlConnectionTarget(server, FirstValue(keys!, DatabaseKeys));
    }

    private static DbConnectionStringBuilder? KeysOf(string connectionString)
    {
        try
        {
            return new DbConnectionStringBuilder { ConnectionString = connectionString };
        }
        catch (ArgumentException)
        {
            return null;
        }
    }

    private static string FirstValue(DbConnectionStringBuilder keys, string[] names)
    {
        var name = names.FirstOrDefault(keys.ContainsKey);

        return name is null ? "" : Convert.ToString(keys[name])?.Trim() ?? "";
    }
}

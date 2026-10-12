using System.Text.RegularExpressions;
using PowerLoom.Contracts;
using PowerLoom.SqlIntegration.Settings;

namespace PowerLoom.SqlIntegration.Features.Connections;

// Settings → Read SQL: the vault's switch and its connections. A connection is added once and then only switched or
// removed; its string is never read back by the page.
public sealed partial class ReadSqlConnections(ReadSqlSettingsStore store)
{
    public async Task SetEnabledAsync(string vault, bool enabled, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);

        settings.Enabled = enabled;
        await store.SaveAsync(vault, settings, cancellation);
    }

    public async Task<Outcome<SqlConnectionSettings>> AddAsync(string vault, string name, string connectionString, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);
        var problem = ProblemOf(settings, name.Trim(), connectionString.Trim());

        if (problem is not null)
            return Outcome<SqlConnectionSettings>.Failure(problem);

        var connection = NewConnection(name.Trim(), connectionString.Trim());

        settings.Connections.Add(connection);
        await store.SaveAsync(vault, settings, cancellation);

        return Outcome<SqlConnectionSettings>.Success(connection);
    }

    public async Task<Outcome<SqlConnectionSettings>> SetConnectionEnabledAsync(string vault, string name, bool enabled, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);
        var connection = settings.Find(name);

        if (connection is null)
            return Outcome<SqlConnectionSettings>.Failure(NotFound(name));

        connection.Enabled = enabled;
        await store.SaveAsync(vault, settings, cancellation);

        return Outcome<SqlConnectionSettings>.Success(connection);
    }

    public async Task RemoveAsync(string vault, string name, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);
        var removed = settings.Connections.RemoveAll(connection => connection.Name.Equals(name, StringComparison.OrdinalIgnoreCase));

        if (removed > 0)
            await store.SaveAsync(vault, settings, cancellation);
    }

    // The saved string of a connection, for the connection test.
    public async Task<Outcome<string>> ConnectionStringOfAsync(string vault, string name, CancellationToken cancellation)
    {
        var connection = (await store.ReadAsync(vault, cancellation)).Find(name);

        return connection is null ? Outcome<string>.Failure(NotFound(name)) : Outcome<string>.Success(connection.ConnectionString);
    }

    private static Problem? ProblemOf(ReadSqlSettings settings, string name, string connectionString)
    {
        if (!ConnectionName().IsMatch(name))
            return Problem.Invalid("A connection name is 1–40 letters, digits, '_' or '-'; agents pick the connection by it.");

        if (settings.Find(name) is not null)
            return Problem.Conflict($"{name} is a connection of this vault already: remove it first to replace it.");

        return SqlConnectionStrings.Parse(connectionString) is null ? Problem.Invalid(SqlConnectionStrings.NotAConnectionString) : null;
    }

    private static SqlConnectionSettings NewConnection(string name, string connectionString)
    {
        var target = SqlConnectionStrings.Parse(connectionString)!;

        return new SqlConnectionSettings { Name = name, Server = target.Server, Database = target.Database, ConnectionString = connectionString, Enabled = true };
    }

    private static Problem NotFound(string name) => Problem.NotFound($"{name} isn't a connection of this vault.");

    [GeneratedRegex(@"^[A-Za-z0-9_-]{1,40}$")]
    private static partial Regex ConnectionName();
}

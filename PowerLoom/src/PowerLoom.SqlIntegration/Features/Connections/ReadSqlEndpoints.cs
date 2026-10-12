using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.Contracts;
using PowerLoom.Features.Repos.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using PowerLoom.SqlIntegration.Features.Connections.Models;
using PowerLoom.SqlIntegration.Settings;
using Wolverine.Http;

namespace PowerLoom.SqlIntegration.Features.Connections;

// Settings → Read SQL (user decision 2026-10-12): the vault's switch, its connections and the connection test. Which
// agents may read is each agent's own switch (the `readSql` integration in its Config).
public static class ReadSqlEndpoints
{
    public static Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation) => VaultChecks.NotAVaultAsync(vault, db, cancellation);

    [WolverinePut("/api/vaults/{vault}/read-sql")]
    public static async Task<Ok> SetEnabled(string vault, EnabledRequest request, ReadSqlConnections connections, CancellationToken cancellation)
    {
        await connections.SetEnabledAsync(vault, request.Enabled, cancellation);

        return TypedResults.Ok();
    }

    [WolverinePost("/api/vaults/{vault}/read-sql/connections")]
    public static async Task<Results<Ok<SqlConnectionSummary>, ProblemHttpResult>> Add(string vault, AddSqlConnectionRequest request, ReadSqlConnections connections, CancellationToken cancellation)
    {
        var added = await connections.AddAsync(vault, request.Name, request.ConnectionString, cancellation);

        return added.Ok ? TypedResults.Ok(SummaryOf(added.Value)) : added.Problem.ToProblemResult();
    }

    [WolverinePut("/api/vaults/{vault}/read-sql/connections/{name}/enabled")]
    public static async Task<Results<Ok<SqlConnectionSummary>, ProblemHttpResult>> SetConnectionEnabled(string vault, string name, EnabledRequest request, ReadSqlConnections connections, CancellationToken cancellation)
    {
        var changed = await connections.SetConnectionEnabledAsync(vault, name, request.Enabled, cancellation);

        return changed.Ok ? TypedResults.Ok(SummaryOf(changed.Value)) : changed.Problem.ToProblemResult();
    }

    [WolverineDelete("/api/vaults/{vault}/read-sql/connections/{name}")]
    public static async Task<Ok> Remove(string vault, string name, [FromServices] ReadSqlConnections connections, CancellationToken cancellation)
    {
        await connections.RemoveAsync(vault, name, cancellation);

        return TypedResults.Ok();
    }

    [WolverinePost("/api/vaults/{vault}/read-sql/test")]
    public static async Task<Results<Ok<SqlConnectionCheck>, ProblemHttpResult>> Test(string vault, TestSqlConnectionRequest request, ReadSqlConnections connections, ISqlConnectionTester tester, CancellationToken cancellation)
    {
        var connectionString = await ConnectionStringOfAsync(vault, request, connections, cancellation);

        if (!connectionString.Ok)
            return connectionString.Problem.ToProblemResult();

        if (SqlConnectionStrings.Parse(connectionString.Value) is null)
            return TypedResults.Ok(new SqlConnectionCheck(false, SqlConnectionStrings.NotAConnectionString));

        return TypedResults.Ok(await tester.TestAsync(connectionString.Value, cancellation));
    }

    // The form's string, or the saved connection's when only its name is given.
    private static async Task<Outcome<string>> ConnectionStringOfAsync(string vault, TestSqlConnectionRequest request, ReadSqlConnections connections, CancellationToken cancellation)
    {
        if (!string.IsNullOrWhiteSpace(request.ConnectionString))
            return Outcome<string>.Success(request.ConnectionString.Trim());

        if (string.IsNullOrWhiteSpace(request.Name))
            return Outcome<string>.Failure(Problem.Invalid("Enter a connection string, or test a saved connection."));

        return await connections.ConnectionStringOfAsync(vault, request.Name.Trim(), cancellation);
    }

    private static SqlConnectionSummary SummaryOf(SqlConnectionSettings connection) => new(connection.Name, connection.Server, connection.Database, connection.Enabled);
}

using PowerLoom.SqlIntegration.Features.Connections;
using PowerLoom.SqlIntegration.Features.Connections.Models;

namespace PowerLoom.Api.Tests.Probes;

// Stands in for the agent-runner's `POST /sql/test`: remembers the string it was asked about.
public sealed class FakeSqlConnectionTester : ISqlConnectionTester
{
    public string? LastConnectionString { get; private set; }

    public SqlConnectionCheck Answer { get; set; } = new(true, "Connected: server db1, database Pvs, SQL Server 16.0.");

    public Task<SqlConnectionCheck> TestAsync(string connectionString, CancellationToken cancellation)
    {
        LastConnectionString = connectionString;

        return Task.FromResult(Answer);
    }
}

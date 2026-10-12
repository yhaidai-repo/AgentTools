using PowerLoom.SqlIntegration.Features.Connections.Models;

namespace PowerLoom.SqlIntegration.Features.Connections;

public interface ISqlConnectionTester
{
    // Never throws: a runner that doesn't answer is an answer too.
    Task<SqlConnectionCheck> TestAsync(string connectionString, CancellationToken cancellation);
}

namespace PowerLoom.SqlIntegration.Features.Connections.Models;

// The agent-runner's `POST /sql/test` body.
public sealed record RunnerSqlTest(string ConnectionString);

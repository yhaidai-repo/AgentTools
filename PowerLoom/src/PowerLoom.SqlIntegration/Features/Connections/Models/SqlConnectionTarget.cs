namespace PowerLoom.SqlIntegration.Features.Connections.Models;

// What a connection string points at; empty Database = the login's default database.
public sealed record SqlConnectionTarget(string Server, string Database);

namespace PowerLoom.SqlIntegration.Features.Connections.Models;

// A new connection's string, or the name of a saved one (then its saved string is used). Nothing is saved.
public sealed record TestSqlConnectionRequest(string? Name, string? ConnectionString);

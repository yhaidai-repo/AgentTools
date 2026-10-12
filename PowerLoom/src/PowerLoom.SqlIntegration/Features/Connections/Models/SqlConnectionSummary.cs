namespace PowerLoom.SqlIntegration.Features.Connections.Models;

// A connection without its string: the browser never gets it back.
public sealed record SqlConnectionSummary(string Name, string Server, string Database, bool Enabled);

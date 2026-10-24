using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Features.Connection.Models;

namespace PowerLoom.AdoIntegration.Features.Connection;

// Checks the token, project and team in one go, as the Settings page needs.
public sealed class ConnectionChecker(IAdoClientFactory clients)
{
    public async Task<ConnectionCheck> CheckAsync(AdoConnection connection, CancellationToken cancellation)
    {
        var client = clients.For(connection);

        try
        {
            return await CheckWithAsync(client, connection, cancellation);
        }
        catch (Exception error) when (error is AdoRequestException or HttpRequestException or TaskCanceledException)
        {
            return new ConnectionCheck(false, error.Message);
        }
    }

    private static async Task<ConnectionCheck> CheckWithAsync(IAdoClient client, AdoConnection connection, CancellationToken cancellation)
    {
        var current = await SprintResolver.ResolveAsync(client, SprintResolver.Current, cancellation);

        if (current is null)
            return new ConnectionCheck(true, "Connected. The team has no current sprint.");

        var ids = await client.QueryIdsAsync(Wiql.SprintScope(connection.Project, current.Path, [], ""), cancellation);

        return new ConnectionCheck(true, $"Connected. Current sprint {current.Name}: {ids.Count} PBIs/bugs in any state.");
    }
}

using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;

namespace PowerLoom.Api.Tests.Probes;

// One shared fake client, and the connections it was asked for (the last one, and every one in order).
public sealed class FakeAdoClientFactory : IAdoClientFactory
{
    public FakeAdoClient Client { get; } = new();

    public AdoConnection? LastConnection { get; private set; }

    public List<AdoConnection> Connections { get; } = [];

    public IAdoClient For(AdoConnection connection)
    {
        LastConnection = connection;
        Connections.Add(connection);

        return Client;
    }
}

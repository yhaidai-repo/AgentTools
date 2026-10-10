using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;

namespace PowerLoom.Api.Tests.Probes;

// One shared fake client, and the last connection it was asked for.
public sealed class FakeAdoClientFactory : IAdoClientFactory
{
    public FakeAdoClient Client { get; } = new();

    public AdoConnection? LastConnection { get; private set; }

    public IAdoClient For(AdoConnection connection)
    {
        LastConnection = connection;

        return Client;
    }
}

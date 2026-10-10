using PowerLoom.AdoIntegration.Client.Models;

namespace PowerLoom.AdoIntegration.Client;

public sealed class AdoClientFactory(IHttpClientFactory httpClients) : IAdoClientFactory
{
    public IAdoClient For(AdoConnection connection) => new AdoClient(httpClients.CreateClient(AdoIntegrationSetup.HttpClientName), connection);
}

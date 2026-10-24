using Microsoft.Extensions.Options;

namespace PowerLoom.ConfluenceIntegration.Client;

public sealed class ConfluenceClientFactory(IHttpClientFactory httpClients, IOptions<ConfluenceOptions> options) : IConfluenceClientFactory
{
    public IConfluenceClient? Create()
    {
        var credentials = options.Value;

        return credentials.IsConfigured ? new ConfluenceClient(httpClients.CreateClient(ConfluenceIntegrationSetup.HttpClientName), credentials.Email.Trim(), credentials.ApiToken.Trim()) : null;
    }
}

using PowerLoom.ConfluenceIntegration.Client;

namespace PowerLoom.Api.Tests.Probes;

// `Configured` false stands for missing credentials: no client, the pages become the user's tasks.
public sealed class FakeConfluenceClientFactory : IConfluenceClientFactory
{
    public FakeConfluenceClient Client { get; } = new();

    public bool Configured { get; set; } = true;

    public IConfluenceClient? Create() => Configured ? Client : null;
}

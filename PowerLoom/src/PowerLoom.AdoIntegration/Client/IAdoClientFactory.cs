using PowerLoom.AdoIntegration.Client.Models;

namespace PowerLoom.AdoIntegration.Client;

// One client per connection (every vault has its own token); tests swap in a fake.
public interface IAdoClientFactory
{
    IAdoClient For(AdoConnection connection);
}

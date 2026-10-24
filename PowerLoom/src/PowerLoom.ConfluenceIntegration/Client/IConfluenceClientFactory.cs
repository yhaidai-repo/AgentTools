namespace PowerLoom.ConfluenceIntegration.Client;

// Null when the credentials aren't set, so the caller can say so instead of failing every call; tests swap in a fake.
public interface IConfluenceClientFactory
{
    IConfluenceClient? Create();
}
